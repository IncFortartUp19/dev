variable "subscription_id" {
  type = string
}

variable "resource_group_name" {
  type    = string
  default = "rg-incforstartup-dev"
}

variable "state_resource_group_name" {
  type    = string
  default = "rg-incforstartup-tfstate"
}

variable "state_storage_account_name" {
  type = string
}
