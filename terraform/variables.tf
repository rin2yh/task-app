variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token (Workers, D1 編集権限)"
  sensitive   = true
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare Account ID"
}

variable "worker_name" {
  type    = string
  default = "task-app"
}

variable "d1_database_name" {
  type    = string
  default = "task-app-prod"
}

