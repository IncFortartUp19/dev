data "azurerm_resource_group" "dev" {
  name = var.resource_group_name
}

data "azurerm_storage_account" "state" {
  name                = var.state_storage_account_name
  resource_group_name = var.state_resource_group_name
}

resource "azurerm_user_assigned_identity" "github" {
  name                = "id-incforstartup-github-dev"
  location            = data.azurerm_resource_group.dev.location
  resource_group_name = data.azurerm_resource_group.dev.name
  tags = {
    project     = "IncForStartUp"
    environment = "dev"
    managed_by  = "terraform"
  }
}

resource "azurerm_federated_identity_credential" "github" {
  name      = "github-dev"
  parent_id = azurerm_user_assigned_identity.github.id
  audience  = ["api://AzureADTokenExchange"]
  issuer    = "https://token.actions.githubusercontent.com"
  subject   = "repo:IncFortartUp19/dev:environment:dev"
}

resource "azurerm_role_assignment" "resources" {
  scope                = data.azurerm_resource_group.dev.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "state" {
  scope                = "${data.azurerm_storage_account.state.id}/blobServices/default/containers/tfstate-dev"
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
  principal_type       = "ServicePrincipal"
}
