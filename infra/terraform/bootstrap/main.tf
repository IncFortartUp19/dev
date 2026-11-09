resource "azurerm_resource_group" "state" {
  name     = "rg-${var.name_prefix}-tfstate"
  location = coalesce(var.resource_group_location, var.location)
  tags     = { project = "IncForStartUp", environment = "bootstrap", managed_by = "terraform" }
}

resource "azurerm_storage_account" "state" {
  name                            = var.state_storage_account_name
  resource_group_name             = azurerm_resource_group.state.name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  allow_nested_items_to_be_public = false

  blob_properties {
    versioning_enabled = true
    delete_retention_policy { days = 30 }
    container_delete_retention_policy { days = 30 }
  }

  tags = azurerm_resource_group.state.tags

  lifecycle { prevent_destroy = true }
}

resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
  lifecycle { prevent_destroy = true }
}

resource "azurerm_storage_container" "dev_state" {
  name                  = "tfstate-dev"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
  lifecycle { prevent_destroy = true }
}
