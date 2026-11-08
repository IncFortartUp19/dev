mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = { tenant_id = "00000000-0000-0000-0000-000000000001" }
  }
}

variables {
  subscription_id = "00000000-0000-0000-0000-000000000000"
  key_vault_name  = "incforstartup-test-vault"
}

run "secure_dev_foundation" {
  command = plan

  assert {
    condition     = azurerm_key_vault.dev.rbac_authorization_enabled && azurerm_key_vault.dev.purge_protection_enabled && !azurerm_key_vault.dev.public_network_access_enabled
    error_message = "The vault must use RBAC, prevent purging and disable public data access."
  }

  assert {
    condition     = azurerm_resource_group.dev.tags.environment == "dev" && azurerm_log_analytics_workspace.dev.daily_quota_gb == 1
    error_message = "Development resources must be tagged and log ingestion capped."
  }
}

run "reject_invalid_prefix" {
  command = plan
  variables { name_prefix = "INVALID PREFIX" }
  expect_failures = [var.name_prefix]
}
