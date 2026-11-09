terraform {
  required_version = "~> 1.13.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {
    storage {
      # Cloud Shell cannot obtain tokens for account-specific blob audiences.
      # Blob retention/versioning and containers use Resource Manager APIs.
      data_plane_available = false
    }
  }
  subscription_id                 = var.subscription_id
  storage_use_azuread             = true
  resource_provider_registrations = "none"
}
