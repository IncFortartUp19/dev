output "backend_config" {
  value = {
    resource_group_name  = azurerm_resource_group.state.name
    storage_account_name = azurerm_storage_account.state.name
    container_name       = azurerm_storage_container.dev_state.name
    key                  = "dev/terraform.tfstate"
    use_azuread_auth     = true
  }
}
