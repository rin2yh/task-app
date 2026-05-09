# CI/CD

GitHub Actions による品質ゲート・本番デプロイ・Terraform 自動化の運用ドキュメントです。平常時のデプロイは本ドキュメントに従います。手動操作や緊急対応は `docs/deployment.md` を参照してください。

## 1. 概要

| Workflow | トリガー | 主な責務 |
|---|---|---|
| `.github/workflows/ci.yml` | `pull_request` (base: `main`) | lint / typecheck / unit (client + workers) / 関連 E2E / build |
| `.github/workflows/deploy.yml` | `push` to `main` (`app/**`, ワークフロー自身) | E2E 全件 → 本番 D1 マイグレーション → `wrangler deploy --env production` |
| `.github/workflows/deploy-develop.yml` | `push` to `main` (`app/**`) + `workflow_dispatch` | E2E 全件 → develop D1 マイグレーション → `wrangler deploy --env develop` |
| `.github/workflows/terraform.yml` | PR (`terraform/**`) | production / develop 両 workspace の `plan` を PR コメント |
| `.github/workflows/terraform-apply.yml` | `push` to `main` (`terraform/**`) + `workflow_dispatch` | production → develop の順で `terraform apply -auto-approve` |

ジョブ順序: lint → typecheck → unit (client + workers) → e2e → build → migrate → deploy。

E2E は PR では `playwright test --only-changed=<base.sha>` で関連 spec のみ、デプロイ前は全件実行します。

## 2. Secrets 配置

Cloudflare アカウント・OAuth App は production / develop で共有するため repo secret に置き、環境ごとに値が異なるものだけ Environment secret に置きます。

### Repo secret（Settings → Secrets and variables → Actions → Repository secrets）

| Secret 名 | 用途 |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID（識別子） |
| `CLOUDFLARE_API_TOKEN` | Workers Scripts:Edit + D1:Edit + Workers R2 Storage:Edit + Account Settings:Read を付与した API token。tfstate の S3 互換認証も `id` と `SHA-256(value)` から派生して使う |
| `CLOUDFLARE_R2_TFSTATE_BUCKET` | tfstate 配置 bucket 名（production / develop で同 bucket、workspace ごとに key が分離） |
| `OAUTH_GITHUB_CLIENT_ID` | GitHub OAuth App の Client ID（共有） |
| `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth App の Client Secret（共有） |

### Environment secret（Settings → Environments → `production` / `develop`）

| Secret 名 | 用途 |
|---|---|
| `SESSION_SECRET` | セッション署名鍵（環境ごとに別値） |
| `APP_URL` | 各環境の公開 URL（例: production=`https://task-app.<account>.workers.dev`、develop=`https://task-app-develop.<account>.workers.dev`） |

### GitHub OAuth App セットアップ

1. https://github.com/settings/developers → **New OAuth App** で OAuth App を作成。production / develop で共有するため、Authorization callback URL は両環境分を登録（GitHub OAuth App は複数 callback を受け付けないので、利用するのは一つ）。本プロジェクトでは production の URL に揃え、develop からのフローも production callback を経由する想定。
   - Homepage URL: production の `${APP_URL}`
   - Authorization callback URL: `${APP_URL}/auth/callback`
2. 発行された Client ID / Client Secret を **Repository secrets** の `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET` に登録。
3. main の `terraform/**` 変更で `terraform-apply.yml` を走らせる（または手動 `workflow_dispatch`）と、上記 secret が `cloudflare_workers_secret.github_client_id` / `github_client_secret` 経由で Worker の `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` に反映されます（production / develop それぞれの Worker に対して）。

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
