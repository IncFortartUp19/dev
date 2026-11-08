output "resource_group_name" {
  value = azurerm_resource_group.dev.name
}

output "key_vault_id" {
  value = azurerm_key_vault.dev.id
}

output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.dev.id
}
