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
      condition     = length(toset([for id in [var.upload_principal_id, var.reader_principal_id, var.promotion_principal_id] : lower(id)])) == 3
      error_message = "Upload, reader and promotion must use three different service identities."
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
