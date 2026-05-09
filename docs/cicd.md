# CI/CD

GitHub Actions による品質ゲート・本番デプロイ・Terraform 自動化の運用ドキュメントです。平常時のデプロイは本ドキュメントに従います。手動操作や緊急対応は `docs/deployment.md` を参照してください。

## 1. 概要

| Workflow | トリガー | 主な責務 |
|---|---|---|
| `.github/workflows/ci.yml` | `pull_request` (base: `main`) | lint / typecheck / unit (client + workers) / 関連 E2E / build |
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

## 3. ローカルで CI 同等のチェックを走らせる

```bash
cd app
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:server
pnpm exec playwright test --only-changed=origin/main
pnpm build

cd ../terraform
terraform fmt -check
tflint
terraform validate
terraform plan
```
