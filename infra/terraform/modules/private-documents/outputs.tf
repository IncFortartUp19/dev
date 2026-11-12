output "storage_account_id" { value = azurerm_storage_account.documents.id }
output "quarantine_container_name" { value = azurerm_storage_container.quarantine.name }
output "released_container_name" { value = azurerm_storage_container.released.name }
output "scan_queue_name" { value = azurerm_servicebus_queue.scans.name }
