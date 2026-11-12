variable "storage_account_name" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "Use a globally unique storage name of 3–24 lowercase letters/digits."
  }
}
variable "resource_group_name" { type = string }
variable "location" {
  type    = string
  default = "francecentral"
}
variable "private_endpoint_subnet_id" { type = string }
variable "blob_private_dns_zone_id" {
  type        = string
  description = "Existing privatelink.blob.core.windows.net zone, linked to the application VNet."
}
variable "scan_results_event_grid_topic_id" {
  type        = string
  description = "Existing custom Event Grid topic for Defender results; authenticated processing must be wired before uploads."
}
variable "upload_principal_id" { type = string }
variable "reader_principal_id" { type = string }
variable "promotion_principal_id" { type = string }
variable "scan_cap_gb_per_month" {
  type    = number
  default = 10
  validation {
    condition     = var.scan_cap_gb_per_month >= 1 && var.scan_cap_gb_per_month <= 1000
    error_message = "Set an explicit scan budget of 1–1000 GB/month; unscanned blobs must remain quarantined."
  }
}
variable "tags" {
  type    = map(string)
  default = {}
}
