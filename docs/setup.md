# 初回セットアップ

ローカル開発を始めるために最初の 1 回だけ必要な手順をまとめます。

## 1. GitHub OAuth アプリの作成

1. https://github.com/settings/developers → **New OAuth App**
2. 入力:
   - Application name: `task-app (local)` 等
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:5173/auth/callback`
3. 発行された Client ID と Client Secret を控えます

本番用は別の OAuth App を用意し、Callback を本番ドメインに合わせます。

## 2. `.dev.vars` の編集

`task-app/app/.dev.vars` をテンプレからコピーして以下を埋めます。

```env
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
SESSION_SECRET="..."        # 32+ 文字のランダム値 (例: openssl rand -hex 32)
APP_URL="http://localhost:5173"
ALLOWED_LOGINS=""            # 空なら誰でもログイン可。カンマ区切りで GitHub login を制限可能
E2E_AUTH=""                  # E2E 走行時のみ "1"
```

`.dev.vars` は git 管理外です。

## 3. Cloudflare アカウントと wrangler

1. `wrangler login` でブラウザ認証
2. ローカル D1 を作成:
   ```bash
   cd task-app/app
   wrangler d1 create task-app-local
   ```
3. 出力された `database_id` を `wrangler.toml` の `[[d1_databases]]` に貼り付け
4. マイグレーション適用:
   ```bash
   pnpm db:migrate:local
   ```

## 4. 本番用シークレット (Terraform 経由)

`docs/deployment.md` を参照してください。Terraform で D1 と Worker のシークレットを一括投入します。

## 5. 動作確認

```bash
cd task-app/app
pnpm dev
```

ブラウザで http://localhost:5173 を開き、GitHub ログインまで一往復できれば OK です。
