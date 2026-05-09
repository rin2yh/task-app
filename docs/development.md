# 開発手順

日常的な開発で使うコマンドと運用上の注意をまとめます。

すべての pnpm コマンドは `task-app/app/` 配下で実行します。

## 開発サーバ

```bash
pnpm dev                  # Vite + Wrangler dev (http://localhost:5173)
```

## テスト

| 層 | コマンド | 概要 |
|---|---|---|
| クライアント (jsdom) | `pnpm test` | React コンポーネントと hooks |
| サーバ (workers pool) | `pnpm test:workers` | Hono ルート、リポジトリ、認可、CSRF を実 D1 で |
| E2E (Playwright) | `pnpm test:e2e` | フルスタックシナリオ |
| カバレッジ | `pnpm test --coverage` | server 90%+ / client 70%+ を CI で要求 |

`pnpm test:e2e` は `config/playwright.config.ts` の `webServer` が `NODE_ENV=test pnpm dev` を自動起動します。手動起動は不要です。

### E2E バックドア

`NODE_ENV === 'test'` のときだけ `createOAuthClient` が `FakeGitHubOAuthClient` を返し、`/auth/github?login=<name>` で任意ユーザーとしてセッションを発行できます。Vite が `process.env.NODE_ENV` をビルド時に静的置換するため、本番ビルドでは分岐ごと dead-code elimination され、フェイク実装はバンドルに含まれません。

## Lint / Format / 型

```bash
pnpm lint                 # Biome check
pnpm format               # Biome format --write
pnpm typecheck            # tsgo --noEmit
```

タスク完了前に `pnpm lint && pnpm typecheck && pnpm test && pnpm test:workers` を回してください (リポジトリ規約)。

## DB マイグレーション

スキーマ (`app/server/db/schema.ts`) を編集したら:

```bash
pnpm generate     # drizzle-kit が server/db/migrations/000X_xxx.sql を生成
pnpm migrate      # ローカル D1 に適用
```

本番への適用は `docs/deployment.md` を参照（CI 自動 / 緊急時のみ手動 wrangler 実行）。

`server/db/migrations/` は git 管理対象です。生成 SQL を必ずコミットしてください。

## Inertia のページ追加

1. `app/client/pages/<name>.tsx` を作成 (ファイル名は kebab-case)
2. ハンドラから `c.render('<name>', props)` で返す
3. Vite が `app/pages.gen.ts` を自動更新します (gitignore 済)

## PWA 開発時の注意

dev では Service Worker を登録しません (`register.ts` で `import.meta.env.DEV` ガード)。SW の動作確認は `pnpm build && pnpm preview` を経由してください。

## トラブルシューティング

### `terraform not found in mise tool registry`
`mise.toml` で `"aqua:hashicorp/terraform" = "1.9.x"` のようにフルバージョン指定してください。

### `aqua:pnpm/pnpm@x.y.z is not installed`
`mise install` を再実行。グローバル設定が aqua バックエンドに pnpm をエイリアスしている場合、リポの `pnpm = "9"` も同じバックエンドで解決されます。

### `wrangler dev` が D1 binding でエラー
`wrangler.toml` の `database_id` がプレースホルダ (`00000000-...`) のままになっていないか確認してください。`wrangler d1 create task-app-local` の出力を貼り付けます。

### `pages.gen.ts not found`
`pnpm dev` を一度起動すると `inertiaPages()` プラグインが生成します。CI で型チェックする場合は `pnpm build` を先に走らせてください。
