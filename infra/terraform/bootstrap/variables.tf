variable "subscription_id" {
  type        = string
  description = "Azure subscription to provision resources into."
}

variable "name_prefix" {
  type    = string
  default = "incforstartup"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,19}$", var.name_prefix))
    error_message = "Use 3–20 lowercase letters, digits or hyphens, starting with a letter."
  }
}

variable "location" {
  type    = string
  default = "westeurope"
}

variable "state_storage_account_name" {
  type        = string
  description = "Globally unique storage account name."
  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.state_storage_account_name))
    error_message = "Use 3–24 lowercase letters or digits."
  }
}
