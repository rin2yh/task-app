provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# default workspace = production（接尾辞なし）/ それ以外 = ワークスペース名を接尾辞に使う。
# d1_database_name のみ既存 production リソース名 "task-app-prod" との互換のため非対称。
locals {
  suffix           = terraform.workspace == "default" ? "" : "-${terraform.workspace}"
  worker_name      = "${var.worker_name}${local.suffix}"
  d1_database_name = local.suffix == "" ? var.d1_database_name : "${var.worker_name}${local.suffix}"
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

# Worker secret (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / SESSION_SECRET / APP_URL) は
# wrangler secret bulk で deploy.yml から注入する。Terraform は触らない。
