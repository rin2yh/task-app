provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# default workspace = production / develop workspace = develop。
# Cloudflare 側のリソースは別物として並走させ、Terraform 設定（変数構造）は同一を保つ。
locals {
  is_develop       = terraform.workspace == "develop"
  worker_name      = local.is_develop ? "${var.worker_name}-develop" : var.worker_name
  d1_database_name = local.is_develop ? "task-app-develop" : var.d1_database_name
}

resource "cloudflare_d1_database" "task_app" {
  account_id = var.cloudflare_account_id
  name       = local.d1_database_name
}

# Worker 本体は wrangler deploy で更新するため、
# Terraform は scaffolding（バインディング/シークレット）のみを管理する。
resource "cloudflare_workers_script" "task_app" {
  account_id = var.cloudflare_account_id
  name       = local.worker_name
  # 初期登録用のダミー content。以後 wrangler deploy が実体を上書きする。
  content = <<-EOT
    export default {
      fetch() { return new Response('bootstrap', { status: 200 }); }
    }
  EOT
  module  = true

  d1_database_binding {
    name        = "DB"
    database_id = cloudflare_d1_database.task_app.id
  }

  lifecycle {
    # content / compatibility_* / plain_text_binding は wrangler deploy が実体を持つ。
    # ここで上書きすると node:events など nodejs_compat 依存のコードが Cloudflare API
    # validation で error 10021 になり apply が落ちる。
    ignore_changes = [
      content,
      module,
      compatibility_date,
      compatibility_flags,
      plain_text_binding,
    ]
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
