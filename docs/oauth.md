# GitHub OAuth App セットアップ

ログインに使う GitHub OAuth App の作成と secrets 配線手順。ローカルと本番で別々の OAuth App を用意します。

## ローカル

1. https://github.com/settings/developers → **New OAuth App**
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:5173/auth/callback`
2. 発行された Client ID / Client Secret を `task-app/app/.dev.vars` の `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` に貼り付け。

## 本番 / develop

production と develop は同じ OAuth App を共有します（Cloudflare アカウントを共有している前提）。

1. https://github.com/settings/developers → **New OAuth App** で OAuth App を作成。
   - Homepage URL: production の `${APP_URL}`（例: `https://task-app.<account>.workers.dev`）
   - Authorization callback URL: `${APP_URL}/auth/callback`
2. 発行された Client ID / Client Secret を、リポジトリ Settings → **Secrets and variables → Actions → Repository secrets** に登録。

   | Secret 名 | 値 |
   |---|---|
   | `OAUTH_GITHUB_CLIENT_ID` | OAuth App の Client ID |
   | `OAUTH_GITHUB_CLIENT_SECRET` | OAuth App の Client Secret |

3. `terraform-apply.yml` が走る（main の `terraform/**` 変更 or `workflow_dispatch` 手動実行）と、上記 secret が `cloudflare_workers_secret.github_client_id` / `github_client_secret` 経由で Worker の `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` に反映されます（production / develop それぞれの Worker に対して）。

production と develop で異なる値の secret は environment（`production` / `develop`）に分けて登録します。

| Secret 名 | 配置 |
|---|---|
| `SESSION_SECRET` | environment ごとに別値で生成 |
| `APP_URL` | production / develop それぞれの `*.workers.dev` |
