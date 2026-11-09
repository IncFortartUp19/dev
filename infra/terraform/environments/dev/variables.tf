variable "subscription_id" {
  type        = string
  description = "Azure subscription to provision resources into."
}

variable "name_prefix" {
  type    = string
  default = "incforstartup"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,15}$", var.name_prefix))
    error_message = "Use 3–16 lowercase letters, digits or hyphens, starting with a letter."
  }
}

variable "location" {
  type        = string
  default     = "francecentral"
  description = "Agreed launch region: France Central (Paris); subscription eligibility must be confirmed by Azure."
}

variable "key_vault_name" {
  type        = string
  description = "Globally unique Key Vault name."
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.key_vault_name)) && !strcontains(var.key_vault_name, "--")
    error_message = "Use 3–24 letters, digits or hyphens, starting with a letter; no consecutive hyphens."
  }
}
