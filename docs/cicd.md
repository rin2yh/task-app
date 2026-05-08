# CI/CD

GitHub Actions による品質ゲート・本番デプロイ・Terraform 自動化の運用ドキュメントです。平常時のデプロイは本ドキュメントに従います。手動操作や緊急対応は `docs/deployment.md` を参照してください。

## 1. 概要

| Workflow | トリガー | 主な責務 |
|---|---|---|
| `.github/workflows/ci.yml` | `pull_request` (base: `main`) | lint / typecheck / unit (client + workers) / 関連 E2E / build |
| `.github/workflows/deploy.yml` | `push` to `main` (`app/**`, ワークフロー自身) | E2E 全件 → 本番 D1 マイグレーション → `wrangler deploy --env production` |
| `.github/workflows/terraform.yml` | PR (`terraform/**`) + `workflow_dispatch` | PR で `plan` を PR コメント |
| `.github/workflows/terraform-apply.yml` | `push` to `main` (`terraform/**`) + `workflow_dispatch` | `terraform apply -auto-approve` |

ジョブ順序: lint → typecheck → unit (client + workers) → e2e → build → migrate → deploy。

E2E は PR では `playwright test --only-changed=<base.sha>` で関連 spec のみ、デプロイ前は全件実行します。

## 2. 初回セットアップ

CI を緑で動かすために、以下を **順番通り** 実施してください。

### 2.1 Cloudflare API トークン作成

Cloudflare ダッシュボード → **My Profile → API Tokens → Create Token** から、以下のスコープでトークンを作成します。

- Workers Scripts: Edit
- D1: Edit
- Account Settings: Read

このトークンは `CLOUDFLARE_API_TOKEN` 1 つの secret に登録すれば、wrangler / Terraform 双方で再利用されます。

### 2.2 GitHub Secrets と production environment

1. リポジトリ Settings → **Environments → New environment** で `production` を作成し、必要なら Required reviewers を設定（apply / deploy ジョブの手動承認ゲート用）。
2. 同 environment の **Environment secrets** に以下を登録します。Cloudflare 系の値は同一 secret を `deploy.yml` / `terraform.yml` / `terraform-apply.yml` で共有して利用します。

| 名称 | 用途 | 取得方法 | 使用 workflow |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | wrangler deploy / d1 migrations apply / Terraform provider 認証 | 2.1 で作成したトークン | `deploy.yml`, `terraform.yml`, `terraform-apply.yml` |
| `CLOUDFLARE_ACCOUNT_ID` | アカウント識別 / R2 backend endpoint URL / Terraform 変数 | ダッシュボード右下 / `wrangler whoami` | `deploy.yml`, `terraform.yml`, `terraform-apply.yml` |
| `OAUTH_GITHUB_CLIENT_ID` | 本番 GitHub OAuth App | https://github.com/settings/developers | `terraform.yml`, `terraform-apply.yml` |
| `OAUTH_GITHUB_CLIENT_SECRET` | 同上 | 同上 | `terraform.yml`, `terraform-apply.yml` |
| `SESSION_SECRET` | セッション署名鍵 | `openssl rand -hex 32` | `terraform.yml`, `terraform-apply.yml` |
| `APP_URL` | 本番 URL | 例: `https://task-app.<account>.workers.dev` | `terraform.yml`, `terraform-apply.yml` |
| `CLOUDFLARE_R2_TFSTATE_BUCKET` | R2 backend のバケット名 | 2.3 で作成 | `terraform.yml`, `terraform-apply.yml` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 backend (S3 互換) 認証 | Cloudflare R2 → Manage R2 API Tokens | `terraform.yml`, `terraform-apply.yml` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | 同上 | 同上 | `terraform.yml`, `terraform-apply.yml` |

### 2.3 Terraform state を Cloudflare R2 backend に移行

state がローカル backend のままだと CI runner のディスクで消失するため、初回に一度だけ R2 backend へ移行します。

1. Cloudflare ダッシュボード → **R2 → Create bucket** で state 用バケットを作成（例: `task-app-tfstate`）。バケット名を `CLOUDFLARE_R2_TFSTATE_BUCKET` Secret に登録します。
2. **R2 → Manage R2 API Tokens** で S3 互換アクセスキーを発行し、`CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` Secret に登録します（ワークフロー側で Terraform S3 backend が読む `AWS_*` env にマップ）。
3. ローカルで state を移行します。

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

### 2.4 `.terraform.lock.hcl` を git 管理へ

ローカルで `terraform init` を行うと生成される `terraform/.terraform.lock.hcl` をコミットしてください（CI とローカルで provider バージョンを揃えるため）。

```bash
cd terraform
terraform init  # ロックファイルが生成される
git add .terraform.lock.hcl
git commit -m "chore(terraform): commit provider lock file"
```

### 2.5 初回 `wrangler deploy` でダミー content を上書き

`terraform apply` 直後の Worker は Terraform スキャフォールドのダミー content のままです。`deploy.yml` を main マージで走らせる前に、ローカルから一度だけ実体を上書きしておきます。

```bash
cd app
pnpm build
pnpm exec wrangler deploy --env production
```

### 2.6 初回フル実行前のチェックリスト

- [ ] GitHub Secrets が全て登録済み（セクション 2.2）
- [ ] `production` environment 作成済み
- [ ] Terraform state が R2 backend に移行済み（セクション 2.3）
- [ ] `terraform/.terraform.lock.hcl` がコミット済み（セクション 2.4）
- [ ] `terraform apply` をローカルで 1 回通し、D1 と Worker scaffold が存在
- [ ] 一度 `wrangler deploy --env production` をローカルから実行し、Terraform のダミー content が実体で上書きされている（セクション 2.5）

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
terraform validate
terraform plan
```

## 4. トラブルシューティング

### `playwright test --only-changed` が想定外の spec を選ぶ
PR ジョブは `actions/checkout@v4` を `fetch-depth: 0` で取得しています。shallow clone のままだと `--only-changed` が base sha との差分を解決できず全件走る/0 件になることがあります。`fetch-depth: 0` が抜けていないか確認してください。

### `wrangler` / `terraform` で認証関連の値が空になる
secret は `production` environment に登録されています。secret を参照するジョブは `environment: production` の指定が必須です。新規ジョブを足す場合は忘れずに付与してください。

### `Error acquiring the state lock`
R2 backend 上に `<key>.tflock` が残っている可能性があります。直前の `apply` がタイムアウトで死んだケースが多いので、Cloudflare R2 のオブジェクトブラウザで該当オブジェクトの中身（lock 主体）を確認してから `terraform force-unlock <LOCK_ID>` で解除します。

### Terraform `plan` の結果コメントが PR に出ない
`plan` ジョブの `permissions: pull-requests: write` が効いていない、もしくはフォーク PR の場合 GitHub の制約で `GITHUB_TOKEN` が read-only になります。フォークからの terraform 変更 PR は対象外と割り切るか、`pull_request_target` への切り替えを検討してください（後者はセキュリティの注意点があるため必要時のみ）。

## 5. ロールバック

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
