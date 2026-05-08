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

## 2. ローカルで CI 同等のチェックを走らせる

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

## 3. ロールバック

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
