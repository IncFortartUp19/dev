data "azurerm_client_config" "current" {}

locals {
  tags = {
    project     = "IncForStartUp"
    environment = "dev"
    managed_by  = "terraform"
  }
}

resource "azurerm_resource_group" "dev" {
  name     = "rg-${var.name_prefix}-dev"
  location = var.location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "dev" {
  name                = "log-${var.name_prefix}-dev"
  location            = azurerm_resource_group.dev.location
  resource_group_name = azurerm_resource_group.dev.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 1
  tags                = local.tags
}

resource "azurerm_key_vault" "dev" {
  name                          = var.key_vault_name
  location                      = azurerm_resource_group.dev.location
  resource_group_name           = azurerm_resource_group.dev.name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  soft_delete_retention_days    = 7
  purge_protection_enabled      = true
  public_network_access_enabled = false
  tags                          = local.tags
}
