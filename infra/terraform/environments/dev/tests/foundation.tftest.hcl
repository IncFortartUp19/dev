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

run "private_key_vault_access" {
  command = plan

  assert {
    condition     = azurerm_private_dns_zone.key_vault.name == "privatelink.vaultcore.azure.net" && !azurerm_private_dns_zone_virtual_network_link.key_vault.registration_enabled
    error_message = "Key Vault private DNS must use its dedicated zone without VM auto-registration."
  }

  assert {
    condition     = azurerm_private_endpoint.key_vault.private_service_connection[0].subresource_names == tolist(["vault"]) && !azurerm_private_endpoint.key_vault.private_service_connection[0].is_manual_connection && !azurerm_key_vault.dev.public_network_access_enabled
    error_message = "The private connection must target the vault without enabling public vault access."
  }
}

run "consumption_hosting_foundation" {
  command = plan

  assert {
    condition     = azurerm_container_registry.dev.sku == "Basic" && !azurerm_container_registry.dev.admin_enabled
    error_message = "Dev registry must use Basic without shared admin credentials."
  }

  assert {
    condition     = one(azurerm_container_app_environment.dev.workload_profile).workload_profile_type == "Consumption" && azurerm_subnet.container_apps.address_prefixes == tolist(["10.20.1.0/24"]) && one(azurerm_subnet.container_apps.delegation).service_delegation[0].name == "Microsoft.App/environments"
    error_message = "Container Apps must use Consumption and its dedicated delegated subnet."
  }
}
