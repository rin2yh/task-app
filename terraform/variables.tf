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

variable "github_client_id" {
  type      = string
  sensitive = true
}

variable "github_client_secret" {
  type      = string
  sensitive = true
}

variable "session_secret" {
  type      = string
  sensitive = true
}

variable "app_url" {
  type        = string
  description = "Public app URL (例: https://task-app.<account>.workers.dev)"
}
