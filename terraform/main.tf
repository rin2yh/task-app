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

# ----------------------------------------------------------------------
# プレビュー環境
# 本番と同じアカウント内に、独立した Worker / D1 / シークレットを持たせる。
# PR ごとに同じ task-app-preview を上書きデプロイする共有環境。
# ----------------------------------------------------------------------

resource "cloudflare_d1_database" "task_app_preview" {
  account_id = var.cloudflare_account_id
  name       = var.preview_d1_database_name
}

resource "cloudflare_workers_script" "task_app_preview" {
  account_id = var.cloudflare_account_id
  name       = var.preview_worker_name
  # 初期登録用のダミー content。以後 wrangler deploy が実体を上書きする。
  content = <<-EOT
    export default {
      fetch() { return new Response('bootstrap', { status: 200 }); }
    }
  EOT
  module  = true

  d1_database_binding {
    name        = "DB"
    database_id = cloudflare_d1_database.task_app_preview.id
  }

  lifecycle {
    ignore_changes = [
      content,
      module,
      compatibility_date,
      compatibility_flags,
      plain_text_binding,
    ]
  }
}

# OAuth App は本番と共有する。GitHub OAuth App 側に preview の callback URL
# (https://<preview-worker>.<account>.workers.dev/auth/callback) も登録しておくこと。
resource "cloudflare_workers_secret" "preview_github_client_id" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.task_app_preview.name
  name        = "GITHUB_CLIENT_ID"
  secret_text = var.github_client_id
}

resource "cloudflare_workers_secret" "preview_github_client_secret" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.task_app_preview.name
  name        = "GITHUB_CLIENT_SECRET"
  secret_text = var.github_client_secret
}

# preview の SESSION_SECRET は terraform で自動生成する。GitHub Secret に
# 環境名付きの秘密を持たせない方針のため、外部入力を取らない。
resource "random_password" "preview_session_secret" {
  length  = 64
  special = false
}

resource "cloudflare_workers_secret" "preview_session_secret" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.task_app_preview.name
  name        = "SESSION_SECRET"
  secret_text = random_password.preview_session_secret.result
}

# APP_URL は preview env の vars.APP_URL から wrangler deploy --var で
# 注入する。Cloudflare 側のシークレットや terraform の管理対象には含めない。
