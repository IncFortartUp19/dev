mock_provider "azurerm" {
  mock_resource "azurerm_servicebus_queue" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test/providers/Microsoft.ServiceBus/namespaces/private/queues/scans"
    }
  }
  mock_resource "azurerm_storage_account" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test/providers/Microsoft.Storage/storageAccounts/incfsdocumentstest"
    }
  }
}

variables {
  storage_account_name             = "incfsdocumentstest"
  resource_group_name              = "rg-documents-test"
  private_endpoint_subnet_id       = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test/providers/Microsoft.Network/virtualNetworks/test/subnets/private"
  blob_private_dns_zone_id         = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test/providers/Microsoft.Network/privateDnsZones/privatelink.blob.core.windows.net"
  scan_results_event_grid_topic_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test/providers/Microsoft.EventGrid/topics/scans"
  upload_principal_id              = "00000000-0000-0000-0000-000000000001"
  reader_principal_id              = "00000000-0000-0000-0000-000000000002"
  promotion_principal_id           = "00000000-0000-0000-0000-000000000003"
  service_bus_namespace_id         = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test/providers/Microsoft.ServiceBus/namespaces/private"
  scan_delivery_principal_id       = "00000000-0000-0000-0000-000000000004"
}

run "private_quarantine_and_released_storage" {
  command = apply
  assert {
    condition     = !azurerm_storage_account.documents.public_network_access_enabled && !azurerm_storage_account.documents.shared_access_key_enabled && !azurerm_storage_account.documents.allow_nested_items_to_be_public && !azurerm_storage_account.documents.cross_tenant_replication_enabled
    error_message = "Documents must disable public access, shared keys and cross-tenant replication."
  }
  assert {
    condition     = azurerm_storage_container.quarantine.container_access_type == "private" && azurerm_storage_container.released.container_access_type == "private"
    error_message = "Both containers must be private."
  }
  assert {
    condition     = azurerm_security_center_storage_defender.documents.malware_scanning_on_upload_enabled && azurerm_security_center_storage_defender.documents.override_subscription_settings_enabled && azurerm_security_center_storage_defender.documents.malware_scanning_on_upload_cap_gb_per_month == 10
    error_message = "Scanning must remain enabled with an explicit budget."
  }
  assert {
    condition     = azurerm_private_endpoint.blob.private_service_connection[0].subresource_names == tolist(["blob"]) && azurerm_private_endpoint.blob.private_dns_zone_group[0].private_dns_zone_ids == tolist([var.blob_private_dns_zone_id])
    error_message = "Blob must use its private endpoint and supplied DNS zone."
  }
  assert {
    condition     = endswith(azurerm_role_assignment.read.scope, "/containers/released") && azurerm_role_assignment.read.role_definition_name == "Storage Blob Data Reader" && endswith(azurerm_role_assignment.upload.scope, "/containers/quarantine")
    error_message = "Read and upload identities must be container-scoped."
  }
  assert {
    condition     = azurerm_eventgrid_event_subscription.scans.event_delivery_schema == "EventGridSchema" && azurerm_eventgrid_event_subscription.scans.included_event_types == tolist(["Microsoft.Security.MalwareScanningResult"]) && azurerm_eventgrid_event_subscription.scans.delivery_identity[0].type == "SystemAssigned" && azurerm_role_assignment.scan_delivery.role_definition_name == "Azure Service Bus Data Sender" && azurerm_role_assignment.scan_receive.role_definition_name == "Azure Service Bus Data Receiver" && azurerm_servicebus_queue.scans.max_delivery_count == 10
    error_message = "Only Defender events must reach the queue using separate sender/receiver identities."
  }
}

run "reject_unbounded_scan_budget" {
  command = plan
  variables { scan_cap_gb_per_month = -1 }
  expect_failures = [var.scan_cap_gb_per_month]
}

run "reject_shared_service_identity" {
  command = plan
  variables { reader_principal_id = "00000000-0000-0000-0000-000000000001" }
  expect_failures = [azurerm_storage_account.documents]
}
