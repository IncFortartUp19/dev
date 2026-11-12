resource "azurerm_storage_account" "documents" {
  name                             = var.storage_account_name
  resource_group_name              = var.resource_group_name
  location                         = var.location
  account_tier                     = "Standard"
  account_replication_type         = "LRS"
  account_kind                     = "StorageV2"
  min_tls_version                  = "TLS1_2"
  https_traffic_only_enabled       = true
  public_network_access_enabled    = false
  shared_access_key_enabled        = false
  default_to_oauth_authentication  = true
  allow_nested_items_to_be_public  = false
  cross_tenant_replication_enabled = false
  tags                             = var.tags

  lifecycle {
    precondition {
      condition     = length(toset([for id in [var.upload_principal_id, var.reader_principal_id, var.promotion_principal_id, var.scan_delivery_principal_id] : lower(id)])) == 4
      error_message = "Upload, reader, promotion and Event Grid delivery must use four different identities."
    }
  }

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
  }
  blob_properties {
    versioning_enabled = true
    delete_retention_policy { days = 7 }
    container_delete_retention_policy { days = 7 }
  }
}

resource "azurerm_storage_container" "quarantine" {
  name                  = "quarantine"
  storage_account_id    = azurerm_storage_account.documents.id
  container_access_type = "private"
}
resource "azurerm_storage_container" "released" {
  name                  = "released"
  storage_account_id    = azurerm_storage_account.documents.id
  container_access_type = "private"
}

resource "azurerm_private_endpoint" "blob" {
  name                = "pe-${var.storage_account_name}-blob"
  resource_group_name = var.resource_group_name
  location            = var.location
  subnet_id           = var.private_endpoint_subnet_id
  tags                = var.tags
  private_service_connection {
    name                           = "blob"
    private_connection_resource_id = azurerm_storage_account.documents.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }
  private_dns_zone_group {
    name                 = "blob"
    private_dns_zone_ids = [var.blob_private_dns_zone_id]
  }
}

resource "azurerm_security_center_storage_defender" "documents" {
  storage_account_id                          = azurerm_storage_account.documents.id
  override_subscription_settings_enabled      = true
  malware_scanning_on_upload_enabled          = true
  malware_scanning_on_upload_cap_gb_per_month = var.scan_cap_gb_per_month
  scan_results_event_grid_topic_id            = var.scan_results_event_grid_topic_id
  sensitive_data_discovery_enabled            = false
}

locals {
  container_scopes = {
    quarantine = "${azurerm_storage_account.documents.id}/blobServices/default/containers/${azurerm_storage_container.quarantine.name}"
    released   = "${azurerm_storage_account.documents.id}/blobServices/default/containers/${azurerm_storage_container.released.name}"
  }
}

resource "azurerm_role_assignment" "upload" {
  scope                = local.container_scopes.quarantine
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.upload_principal_id
}
resource "azurerm_role_assignment" "read" {
  scope                = local.container_scopes.released
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = var.reader_principal_id
}
resource "azurerm_role_assignment" "promote" {
  for_each             = local.container_scopes
  scope                = each.value
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.promotion_principal_id
}

resource "azurerm_servicebus_queue" "scans" {
  name                                 = "${var.storage_account_name}-scans"
  namespace_id                         = var.service_bus_namespace_id
  lock_duration                        = "PT1M"
  max_delivery_count                   = 10
  default_message_ttl                  = "P7D"
  dead_lettering_on_message_expiration = true
}

resource "azurerm_role_assignment" "scan_delivery" {
  scope                = azurerm_servicebus_queue.scans.id
  role_definition_name = "Azure Service Bus Data Sender"
  principal_id         = var.scan_delivery_principal_id
}

resource "azurerm_role_assignment" "scan_receive" {
  scope                = azurerm_servicebus_queue.scans.id
  role_definition_name = "Azure Service Bus Data Receiver"
  principal_id         = var.promotion_principal_id
}

resource "azurerm_eventgrid_event_subscription" "scans" {
  name                          = "${var.storage_account_name}-malware-results"
  scope                         = var.scan_results_event_grid_topic_id
  included_event_types          = ["Microsoft.Security.MalwareScanningResult"]
  event_delivery_schema         = "EventGridSchema"
  service_bus_queue_endpoint_id = azurerm_servicebus_queue.scans.id
  advanced_filter {
    string_begins_with {
      key    = "data.blobUri"
      values = ["https://${var.storage_account_name}.blob.core.windows.net/quarantine/", "https://${var.storage_account_name}.blob.core.windows.net/released/"]
    }
  }
  delivery_identity {
    type = "SystemAssigned"
  }
  retry_policy {
    max_delivery_attempts = 30
    event_time_to_live    = 1440
  }
  depends_on = [azurerm_role_assignment.scan_delivery]
}
