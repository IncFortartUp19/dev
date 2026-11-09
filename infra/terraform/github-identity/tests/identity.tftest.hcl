mock_provider "azurerm" {
  mock_data "azurerm_resource_group" {
    defaults = {
      id       = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-incforstartup-dev"
      name     = "rg-incforstartup-dev"
      location = "francecentral"
    }
  }
  mock_data "azurerm_storage_account" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-incforstartup-tfstate/providers/Microsoft.Storage/storageAccounts/incforstartupstate001"
    }
  }
}

variables {
  subscription_id            = "00000000-0000-0000-0000-000000000000"
  state_storage_account_name = "incforstartupstate001"
}

run "restricted_federation" {
  command = plan

  assert {
    condition     = azurerm_federated_identity_credential.github.subject == "repo:IncFortartUp19@354242787/dev@1450737434:environment:dev" && azurerm_federated_identity_credential.github.issuer == "https://token.actions.githubusercontent.com" && azurerm_federated_identity_credential.github.audience == tolist(["api://AzureADTokenExchange"])
    error_message = "Federation must trust only this repository and dev environment through GitHub OIDC."
  }

  assert {
    condition     = azurerm_role_assignment.resources.scope == data.azurerm_resource_group.dev.id && azurerm_role_assignment.resources.role_definition_name == "Contributor" && endswith(azurerm_role_assignment.state.scope, "/containers/tfstate-dev") && azurerm_role_assignment.state.role_definition_name == "Storage Blob Data Contributor"
    error_message = "Permissions must be scoped to the dev resource group and state container."
  }
}
