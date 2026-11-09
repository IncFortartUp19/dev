mock_provider "azurerm" {}

variables {
  location                   = "francecentral"
  resource_group_location    = null
  subscription_id            = "00000000-0000-0000-0000-000000000000"
  state_storage_account_name = "incforstartupstatetest"
}

run "paris_deployment" {
  command = plan
  assert {
    condition     = azurerm_resource_group.state.location == "francecentral" && azurerm_storage_account.state.location == "francecentral"
    error_message = "New bootstrap deployments must use France Central."
  }
}

run "preserve_existing_group" {
  command = plan
  variables {
    resource_group_location = "westeurope"
  }
  assert {
    condition     = azurerm_resource_group.state.location == "westeurope" && azurerm_storage_account.state.location == "francecentral"
    error_message = "The existing resource group must stay in West Europe while storage is created in Paris."
  }
}
