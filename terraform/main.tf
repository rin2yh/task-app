provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_d1_database" "task_app" {
  account_id = var.cloudflare_account_id
  name       = var.d1_database_name
}

# Worker 本体は wrangler deploy で更新するため、
# Terraform は scaffolding（バインディング/シークレット）のみを管理する。
resource "cloudflare_workers_script" "task_app" {
  account_id = var.cloudflare_account_id
  name       = var.worker_name
  # 初期登録用のダミー content。以後 wrangler deploy が実体を上書きする。
  content    = <<-EOT
    export default {
      fetch() { return new Response('bootstrap', { status: 200 }); }
    }
  EOT
  module     = true

  d1_database_binding {
    name        = "DB"
    database_id = cloudflare_d1_database.task_app.id
  }

  lifecycle {
    ignore_changes = [content, module]
  }
}

resource "cloudflare_workers_secret" "github_client_id" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.task_app.name
  name        = "GITHUB_CLIENT_ID"
  secret_text = var.github_client_id
}

resource "cloudflare_workers_secret" "github_client_secret" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.task_app.name
  name        = "GITHUB_CLIENT_SECRET"
  secret_text = var.github_client_secret
}

resource "cloudflare_workers_secret" "session_secret" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.task_app.name
  name        = "SESSION_SECRET"
  secret_text = var.session_secret
}

resource "cloudflare_workers_secret" "app_url" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.task_app.name
  name        = "APP_URL"
  secret_text = var.app_url
}
