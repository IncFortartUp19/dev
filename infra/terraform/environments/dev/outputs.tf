output "resource_group_name" {
  value = azurerm_resource_group.dev.name
}

output "key_vault_id" {
  value = azurerm_key_vault.dev.id
}

output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.dev.id
}

output "virtual_network_id" {
  value = azurerm_virtual_network.dev.id
}

output "private_endpoint_subnet_id" {
  value = azurerm_subnet.private_endpoints.id
}

output "container_registry_name" {
  value = azurerm_container_registry.dev.name
}

output "container_registry_login_server" {
  value = azurerm_container_registry.dev.login_server
}

output "container_app_environment_id" {
  value = azurerm_container_app_environment.dev.id
}
