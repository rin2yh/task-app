# CI/CD

GitHub Actions による品質ゲート・本番デプロイ・Terraform 自動化の運用ドキュメントです。平常時のデプロイは本ドキュメントに従います。手動操作や緊急対応は `docs/deployment.md` を参照してください。

## 1. 概要

| Workflow | トリガー | 主な責務 |
|---|---|---|
| `.github/workflows/ci.yml` | `pull_request` (base: `main`) | lint / typecheck / unit (client + workers) / 関連 E2E / build |
| `.github/workflows/deploy.yml` | `push` to `main` (`app/**`, ワークフロー自身) | E2E 全件 → 本番 D1 マイグレーション → `wrangler deploy --env production` |
| `.github/workflows/terraform.yml` | PR / push to `main` (`terraform/**`) + `workflow_dispatch` | PR で `plan` を PR コメント、`main` push で `apply` |

ジョブ順序: lint → typecheck → unit (client + workers) → e2e → build → migrate → deploy。

E2E は PR では `playwright test --only-changed=<base.sha>` で関連 spec のみ、デプロイ前は全件実行します。

## 2. 初回セットアップ

CI を緑で動かすために、以下を **順番通り** 実施してください。

### 2.1 Cloudflare API トークン作成

Cloudflare ダッシュボード → **My Profile → API Tokens → Create Token** から、以下のスコープでトークンを作成します。

- Workers Scripts: Edit
- D1: Edit
- Account Settings: Read

このトークンは GitHub Secrets の `CLOUDFLARE_API_TOKEN` と Terraform 用 `TF_VAR_cloudflare_api_token` の両方に同じ値を入れて構いません。

### 2.2 GitHub Secrets と production environment

1. リポジトリ Settings → **Environments → New environment** で `production` を作成し、必要なら Required reviewers を設定（apply / deploy ジョブの手動承認ゲート用）。Secrets を environment 側に登録する必要は無い — 全て repository secrets で運用する。
2. リポジトリ Settings → **Secrets and variables → Actions** に以下を登録します。Cloudflare 系の値は同一 secret を `deploy.yml` も `terraform.yml` / `terraform-apply.yml` も共有して利用します。

| 名称 | 用途 | 取得方法 | 使用 workflow |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | wrangler deploy / d1 migrations apply / Terraform provider 認証 | 2.1 で作成したトークン | `deploy.yml`, `terraform.yml`, `terraform-apply.yml` |
| `CLOUDFLARE_ACCOUNT_ID` | アカウント識別 / R2 backend endpoint URL / Terraform 変数 | ダッシュボード右下 / `wrangler whoami` | `deploy.yml`, `terraform.yml`, `terraform-apply.yml` |
| `TF_VAR_github_client_id` | 本番 GitHub OAuth App | https://github.com/settings/developers | `terraform.yml`, `terraform-apply.yml` |
| `TF_VAR_github_client_secret` | 同上 | 同上 | `terraform.yml`, `terraform-apply.yml` |
| `TF_VAR_session_secret` | セッション署名鍵 | `openssl rand -hex 32` | `terraform.yml`, `terraform-apply.yml` |
| `TF_VAR_app_url` | 本番 URL | 例: `https://task-app.<account>.workers.dev` | `terraform.yml`, `terraform-apply.yml` |
| `TF_BACKEND_BUCKET` | R2 backend のバケット名 | 2.4 で作成 | `terraform.yml`, `terraform-apply.yml` |
| `AWS_ACCESS_KEY_ID` | R2 backend (S3 互換) 認証 | Cloudflare R2 → Manage R2 API Tokens | `terraform.yml`, `terraform-apply.yml` |
| `AWS_SECRET_ACCESS_KEY` | 同上 | 同上 | `terraform.yml`, `terraform-apply.yml` |

### 2.3 `wrangler.toml` の本番 `database_id` 差し替え

ローカルで一度 `terraform apply` を通し、出力の `d1_database_id` を `app/wrangler.toml` の `[[env.production.d1_databases]]` の `database_id` に貼り付けてコミットします。プレースホルダのままだと `wrangler d1 migrations apply task-app-prod --remote` が失敗します。

### 2.4 Terraform state を Cloudflare R2 backend に移行

`terraform.yml` の `apply` ジョブを有効化する **前に** 一度だけ実施します。state がローカル backend のままだと CI runner のディスクで消失します。

1. Cloudflare ダッシュボード → **R2 → Create bucket** で state 用バケットを作成（例: `task-app-tfstate`）。バケット名を `TF_BACKEND_BUCKET` Secret に登録します。
2. **R2 → Manage R2 API Tokens** で S3 互換アクセスキーを発行し、`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` Secret に登録します。
3. ローカルで state を移行します。`terraform/backend.tf` は既に `s3` backend に書き換え済みです。

   ```bash
   cd terraform
   export AWS_ACCESS_KEY_ID=<R2 access key>
   export AWS_SECRET_ACCESS_KEY=<R2 secret>
   terraform init \
     -backend-config="bucket=task-app-tfstate" \
     -backend-config="endpoints={s3=\"https://<account_id>.r2.cloudflarestorage.com\"}" \
     -migrate-state
   ```

4. `terraform plan` が no-change で通ることを確認します。

### 2.5 `.terraform.lock.hcl` を git 管理へ

`terraform/.gitignore` の除外は解除済みです。ローカルで `terraform init` を行うと生成される `terraform/.terraform.lock.hcl` をコミットしてください（CI とローカルで provider バージョンを揃えるため）。

```bash
cd terraform
terraform init  # ロックファイルが生成される
git add .terraform.lock.hcl
git commit -m "chore(terraform): commit provider lock file"
```

## 3. ワークフロー有効化の段取り

ワークフローは以下の順で段階的に有効化してください。リポジトリにマージ済みの初期状態は `deploy` ジョブと `apply` ジョブが `if: false` で無効化されています。

1. リポジトリ前提修正（`wrangler.toml` の `database_id`、`@playwright/test` 1.50+、`backend.tf`、`.terraform.lock.hcl` コミット）を 1 PR にまとめて main にマージ。
2. `ci.yml` 投入後、ダミー PR を立てて全 job 緑を確認。
3. `terraform.yml` の `plan` ジョブを動作確認（`terraform/**` 修正 PR を立て、PR コメントに plan 結果が貼られることを確認）。
4. `deploy.yml` の `e2e-full` と `migrate-db` だけ動かして API トークン権限を検証（`deploy` ジョブは `if: false` のまま）。
5. 2.4 の R2 backend 移行を完了後、`terraform.yml` の `apply` ジョブの `if: false` を `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` に変更。
6. 初回 `wrangler deploy --env production` をローカルから 1 回実行し、Terraform 初期スキャフォールドのダミー content を実体で上書き。
7. `deploy.yml` の `deploy` ジョブの `if: false` を削除し、main マージで初回フル実行。

### 初回フル実行前のチェックリスト

- [ ] `app/wrangler.toml` の本番 `database_id` が実値に差し替え済み
- [ ] `terraform apply` をローカルで 1 回通し、D1 と Worker scaffold が存在
- [ ] 一度 `wrangler deploy --env production` をローカルから実行し、Terraform のダミー content が実体で上書きされている
- [ ] GitHub Secrets が全て登録済み（セクション 2.2）
- [ ] `production` environment 作成済み
- [ ] `@playwright/test` が 1.50+
- [ ] `terraform/.terraform.lock.hcl` がコミット済み
- [ ] Terraform state が R2 backend に移行済み

## 4. ローカルで CI 同等のチェックを走らせる

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
terraform validate
terraform plan
```

## 5. トラブルシューティング

### `wrangler d1 migrations apply task-app-prod --remote` が失敗する
`app/wrangler.toml` の本番 `database_id` がプレースホルダのままになっていないか確認してください（セクション 2.3）。

### `playwright test --only-changed` が想定外の spec を選ぶ
PR ジョブは `actions/checkout@v4` を `fetch-depth: 0` で取得しています。shallow clone のままだと `--only-changed` が base sha との差分を解決できず全件走る/0 件になることがあります。`fetch-depth: 0` が抜けていないか確認してください。

### `wrangler` 認証エラー
Secrets が repository secrets として登録されていない、または値が空でないか確認してください（Settings → Secrets and variables → Actions）。`production` environment は手動承認ゲートとしてのみ使用しており、secrets はそちらに登録不要です。

### `Error acquiring the state lock`
R2 backend 上に `<key>.tflock` が残っている可能性があります。直前の `apply` がタイムアウトで死んだケースが多いので、Cloudflare R2 のオブジェクトブラウザで該当オブジェクトの中身（lock 主体）を確認してから `terraform force-unlock <LOCK_ID>` で解除します。

### Terraform `plan` の結果コメントが PR に出ない
`plan` ジョブの `permissions: pull-requests: write` が効いていない、もしくはフォーク PR の場合 GitHub の制約で `GITHUB_TOKEN` が read-only になります。フォークからの terraform 変更 PR は対象外と割り切るか、`pull_request_target` への切り替えを検討してください（後者はセキュリティの注意点があるため必要時のみ）。

## 6. ロールバック

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
