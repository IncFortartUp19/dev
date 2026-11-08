output "github_variables" {
  description = "Non-secret values to configure on the GitHub dev environment."
  value = {
    AZURE_CLIENT_ID       = azurerm_user_assigned_identity.github.client_id
    AZURE_TENANT_ID       = azurerm_user_assigned_identity.github.tenant_id
    AZURE_SUBSCRIPTION_ID = var.subscription_id
  }
}
