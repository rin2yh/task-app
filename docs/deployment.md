# デプロイ

> 平常時のデプロイは GitHub Actions が自動で実行します。CI/CD の設定・運用は [`docs/cicd.md`](./cicd.md) を参照してください。本ドキュメントは初回セットアップ・緊急時の手動操作・Terraform の詳細を扱います。

Cloudflare Workers + D1 への本番デプロイ手順です。Terraform で scaffolding (D1、Worker、Secrets) を作り、Worker 本体は `wrangler deploy` で更新する 2 段構成です。

## 0. 前提

- Cloudflare API トークン (Workers Scripts 編集 + D1 編集権限)
- 本番用 GitHub OAuth App (callback URL: `https://<your-domain>/auth/callback`)
- `task-app/terraform/terraform.tfvars` を `terraform.tfvars.example` から作成

## 1. Terraform で初回作成

```bash
cd task-app/terraform
terraform init
terraform plan
terraform apply
```

apply 出力の `d1_database_id` を `task-app/app/wrangler.toml` の本番用 `[[env.production.d1_databases]]` に貼り付けます。

Worker 本体は `lifecycle.ignore_changes = [content, module]` のため、Terraform は初回作成時のダミー content だけを置きます。実体は次の手順で上書きします。

## 2. 本番マイグレーション

平常時は GitHub Actions の `deploy.yml` が自動実行します。緊急時の手動実行:

```bash
cd task-app/app
pnpm db:migrate:prod
```

## 3. ビルドとデプロイ

平常時は GitHub Actions の `deploy.yml` が自動実行します。緊急時の手動実行:

```bash
cd task-app/app
pnpm build
wrangler deploy --env production
```

## 4. Secrets の追加・更新

シークレットは Terraform で管理しています (`cloudflare_workers_secret`)。値を変える場合は `terraform.tfvars` を編集して再 apply してください。`wrangler secret put` を直に叩くと state が乖離します。

例外: 緊急対応で wrangler から直接更新した場合は、`terraform.tfvars` の値も同時に揃え、次の apply で no-change にします。

## 5. ロールバック

- アプリ側: `wrangler rollback <version-id>` で前バージョンの Worker に戻せます
- DB: マイグレーションは前進のみ。破壊的変更は先に互換 migration → コードデプロイ → cleanup migration の順を徹底してください

## 6. cron トリガ

`wrangler.toml` の `[triggers] crons = ["0 3 * * *"]` で毎日 03:00 UTC に `scheduled` ハンドラ (期限切れセッションの purge) が走ります。

## 7. Preview 環境

動作確認用の共有 preview 環境（Worker `task-app-preview` + D1 `task-app-preview`）を持っています。**自動デプロイはしません**。`.github/workflows/preview.yml` を手動 (`workflow_dispatch`) で起動して使います。

GitHub UI から:

1. Actions → "Deploy preview" → **Run workflow**
2. Branch: 動作確認したいブランチを選択
3. `pr_number`: 対応する PR があれば番号を入れる（その PR にプレビュー URL の sticky コメントが付く）

CLI から (`gh` を使う場合):

```bash
gh workflow run preview.yml --ref <branch> -f pr_number=<n>
```

ローカルからの直接デプロイ（緊急時）:

```bash
cd task-app/app
pnpm db:migrate:preview
pnpm build
wrangler deploy --env preview
```

preview Worker は単一です。複数ブランチを並行に確認するときは「最後にデプロイしたブランチが見える」運用になる点に注意してください。Worker 名・D1 名・シークレットは `terraform/main.tf` の `*_preview` 系リソースで管理しています。本番とは独立した OAuth App / SESSION_SECRET を払い出すこと。データは preview 専用 D1 に閉じるので本番に影響しません。
