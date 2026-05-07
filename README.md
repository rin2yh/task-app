# task-app

GitHub Projects 風カンバンタスク管理 PWA。Cloudflare Workers + D1 + Hono + Inertia + React。

## クイックスタート

```bash
# 1. ツール (node / pnpm / terraform) を mise で取得
mise trust
mise install

# 2. 依存と secrets
cd app
pnpm install
cp .dev.vars.example .dev.vars        # 編集して GitHub OAuth 等を設定

# 3. ローカル D1 を作成して migration 適用
wrangler d1 create task-app-local      # 出力 database_id を wrangler.toml に貼る
pnpm db:migrate:local

# 4. 起動
pnpm dev                               # http://localhost:5173
```

## ドキュメント

- [docs/setup.md](docs/setup.md) — GitHub OAuth アプリ作成、Cloudflare アカウント、シークレット設定
- [docs/development.md](docs/development.md) — テスト、マイグレーション、E2E、PWA、トラブルシューティング
- [docs/deployment.md](docs/deployment.md) — Terraform + `wrangler deploy` 本番デプロイ手順
