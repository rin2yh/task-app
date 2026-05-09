# CI/CD

GitHub Actions による品質ゲート・本番デプロイ・Terraform 自動化の運用ドキュメントです。平常時のデプロイは本ドキュメントに従います。手動操作や緊急対応は `docs/deployment.md` を参照してください。

## 1. 概要

| Workflow | トリガー | 主な責務 |
|---|---|---|
| `.github/workflows/ci.yml` | `pull_request` (base: `main`) | lint / typecheck / unit (client + workers) / 関連 E2E / build |
| `.github/workflows/preview.yml` | `workflow_dispatch` (手動) | preview D1 マイグレーション → `wrangler deploy --env preview` → 指定 PR に URL コメント |
| `.github/workflows/deploy.yml` | `push` to `main` (`app/**`, ワークフロー自身) | E2E 全件 → 本番 D1 マイグレーション → `wrangler deploy --env production` |
| `.github/workflows/terraform.yml` | PR (`terraform/**`) | PR で `plan` を PR コメント |
| `.github/workflows/terraform-apply.yml` | `push` to `main` (`terraform/**`) + `workflow_dispatch` | `terraform apply -auto-approve` |

ジョブ順序: lint → typecheck → unit (client + workers) → e2e → build → migrate → deploy。

E2E は PR では `playwright test --only-changed=<base.sha>` で関連 spec のみ、デプロイ前は全件実行します。

## 2. GitHub OAuth App セットアップ

OAuth 関連は未設定です。以下の手順で本番用 OAuth App を用意します。

1. https://github.com/settings/developers → **New OAuth App** で本番用 OAuth App を作成。
   - Homepage URL: `${APP_URL}`（例: `https://task-app.<account>.workers.dev`）
   - Authorization callback URL: `${APP_URL}/auth/callback`
2. 発行された Client ID / Client Secret を、リポジトリ Settings → **Environments → production → Environment secrets** に登録。

   | Secret 名 | 値 |
   |---|---|
   | `OAUTH_GITHUB_CLIENT_ID` | OAuth App の Client ID |
   | `OAUTH_GITHUB_CLIENT_SECRET` | OAuth App の Client Secret |

3. main の `terraform/**` 変更で `terraform-apply.yml` を走らせる（または手動 `workflow_dispatch`）と、上記 secret が `cloudflare_workers_secret.github_client_id` / `github_client_secret` 経由で Worker の `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` に反映されます。

### Preview 環境の secrets / variables

OAuth App は本番と共有します。本番用 OAuth App の **Authorization callback URL** に `${PREVIEW_APP_URL}/auth/callback`（例: `https://task-app-preview.<account>.workers.dev/auth/callback`）を追加で登録してください（GitHub OAuth App は callback URL を複数登録可）。

リポジトリ Settings → **Environments → preview → Environment secrets / variables** に以下を登録します。

| 種類 | 名前 | 値 |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Workers / D1 編集権限を持つトークン |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |
| Variable | `PREVIEW_APP_URL` | プレビュー Worker の公開 URL（PR コメント表示用） |

Worker 側のシークレット（`SESSION_SECRET` / `APP_URL` の preview 値）は `terraform.tfvars` の `preview_session_secret` / `preview_app_url` を埋めて `terraform-apply.yml` で適用します。`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` は本番値を再利用するので追加登録不要です。

## 3. ローカルで CI 同等のチェックを走らせる

```bash
cd app
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:workers
pnpm exec playwright test --only-changed=origin/main
pnpm build

cd ../terraform
terraform fmt -check
tflint
terraform validate
terraform plan
```

## 4. ロールバック

### アプリ側（Worker）
```bash
cd app
wrangler rollback --env production <version-id>
```

直近にデプロイしたバージョンの ID は Cloudflare ダッシュボード → Workers & Pages → task-app → Deployments で確認できます。

### DB
マイグレーションは前進のみ。破壊的変更は次のフローを徹底します。

1. 互換 migration（旧スキーマと共存可能な変更）をデプロイ
2. アプリコードの参照を新スキーマに切り替えてデプロイ
3. cleanup migration（旧カラム削除など）をデプロイ

ロールバック時は (2) のコードのみ巻き戻して (1) の互換状態に留め、データを失わないようにします。
