# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

- `app/` — Cloudflare Worker + Vite/React client. **All `pnpm` commands run here.**
- `terraform/` — D1 + Worker + secrets scaffolding (state lives outside the repo).
- `docs/` — `setup.md`, `development.md`, `deployment.md`, `cicd.md`.
- `mise.toml` pins `node 24` / `pnpm 11` / `terraform 1.9.8` / `tflint 0.55.1`.

## Commands (inside `app/`)

Scripts are defined in @app/package.json. Notes:

- `test` = client/pages (jsdom, 70% gate); `test:workers` = server in `@cloudflare/vitest-pool-workers` w/ real D1 (90%/85% gate); `test:e2e` auto-runs `E2E_AUTH=1 pnpm dev` via Playwright `webServer`.
- `preview` = `wrangler dev` against the built worker — use it to verify the PWA SW.
- `db:generate` writes `migrations/000X_*.sql` from `server/db/schema.ts`; commit the SQL.
- Single test: `pnpm exec vitest run path/to.test.ts -t "name"` (add `--config vitest.workers.config.ts` for server) or `pnpm exec playwright test specs/x.spec.ts -g "name"`.
- Project gate before declaring done: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:workers`.

## Architecture

- **Worker entry** `app/server.ts`: `Hono<AppEnv>` with global `sessionLoader` + `inertia({ rootView })`, route modules under `server/routes/*`. Also exports `scheduled()` running `purgeExpired` (cron `0 3 * * *`).
- **Inertia/SSR**: `c.render('<name>', props)` resolves to `app/pages/<name>.tsx` (kebab-case). `inertiaPages()` writes `pages.gen.ts` (gitignored — `pnpm dev`/`build` regenerates; needed for typecheck). Hydration in `client/client.tsx`. Always spread `buildSharedProps(c)` (from `server/inertia/share.ts`) into props.
- **Auth**: arctic + `server/auth/github-client.ts`; `oauth-factory.ts` swaps `FakeGitHubOAuthClient` when `E2E_AUTH=1`. Server-side `sessions` (30d). Mutating routes chain `requireAuth` (router-level) + `csrfGuard` (per-handler). CSRF = `csrf` cookie + `X-CSRF-Token` header both equal session csrfToken. `requireAuth` returns 409 + `X-Inertia-Location` for Inertia, else 302 — don't replace with JSON 401.
- **Data**: Drizzle on D1; `server/db/schema.ts` is source of truth. Repos in `server/db/repositories/*` enforce ownership via `ownerId` joined through `projects.ownerId`; cross-tenant returns `null` → routes throw `NotFound`. IDs are ULIDs (`server/db/ulid.ts`).
- **Ordering**: float `position` column, midpoint insertion in `server/lib/position.ts` with 1e-6 rebalance threshold; `moveTask` falls back to 1..N `rebalance()` when gap collapses. Don't introduce alternate ordering schemes.
- **Aliases** (in `tsconfig.json`, `vite.config.ts`, both vitest configs): `@/` → `app/`, `@server/`, `@client/`, `@shared/`. Use them in new code.
- **Frontend**: React 19 + Inertia + Tailwind v4 + shadcn/ui (`new-york`, `@/components/ui`); `@dnd-kit`; optimistic board in `client/hooks/use-optimistic-board.ts`.
- **PWA**: `vite-plugin-pwa` injectManifest, SW at `client/pwa/sw.ts`. `register.ts` is `import.meta.env.DEV`-guarded — verify SW via `pnpm build && pnpm preview`.
- **Test helpers**: `server/_test-helpers.ts` (`applyMigrations`, `createTestUser`) instead of poking D1 directly.

## Project rules (`.claude/rules/`)

- **`react.md`**: NO `useMemo` / `useCallback` / `React.memo`. Don't add for "new identity" review feedback. Remove existing.
- **`e2e.md`**: NO `data-testid` (in product code or tests) — remove on sight. Locator priority: role+name → label/placeholder → text → landmark → (last resort) `aria-label`. Web-first assertions only (`await expect(locator).toBeVisible()`). No `page.waitForTimeout`. Mock externals with `page.route()`; for auth use the `authenticate(login)` fixture (`tests/e2e/fixtures/session.ts`). Tests independent — set up data per test.

## Gotchas

- `wrangler.toml` ships placeholder `database_id = "00000000-..."` for local D1 (per-developer; don't commit your real id).
- `pages.gen.ts` is gitignored — type errors about missing pages mean it hasn't been generated.
- `E2E_AUTH=1` enables `POST /auth/test-login` + fake OAuth, stripped in prod via Vite define. Don't gate non-test logic on it.
- Migrations are forward-only — destructive changes need compatible migration → code switch → cleanup migration (document in PR).
- Worker secrets are owned by Terraform (`cloudflare_workers_secret`); don't `wrangler secret put` directly. Production deploy is automatic on push to `main` (`.github/workflows/deploy.yml`).
- Only deploy artifact is `dist/client` (Worker `ASSETS` binding); `pnpm test:workers` creates it on its own.
