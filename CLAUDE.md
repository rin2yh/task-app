# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Monorepo-ish layout where the app lives in a single workspace and infra is parallel:

- `app/` — full stack (Cloudflare Worker + Vite/React client). **All `pnpm` commands run from here.**
- `terraform/` — Cloudflare D1 + Worker scaffolding and secrets (state lives outside the repo).
- `docs/` — `setup.md`, `development.md`, `deployment.md`, `cicd.md`. Authoritative source for env / OAuth / deploy steps.
- `.github/workflows/` — `ci.yml` (PR), `deploy.yml` (push to `main`), `terraform.yml` / `terraform-apply.yml`.
- `mise.toml` pins `node 24`, `pnpm 11`, `terraform 1.9.8`, `tflint 0.55.1` — bootstrap with `mise trust && mise install`.

## Common commands (run inside `app/`)

```bash
pnpm dev               # Vite + Wrangler dev on http://localhost:5173
pnpm build             # Vite build (writes dist/client used by wrangler ASSETS)
pnpm preview           # wrangler dev against the built worker (use this to test the PWA SW)

pnpm lint              # Biome check (lint + format diagnostics)
pnpm format            # Biome format --write
pnpm typecheck         # tsc --noEmit

pnpm test              # client + page tests in jsdom (vitest.config.ts)
pnpm test:workers      # server tests in @cloudflare/vitest-pool-workers with real D1 + migrations applied
pnpm test:e2e          # Playwright; auto-spawns `E2E_AUTH=1 pnpm dev` via webServer

pnpm db:generate       # drizzle-kit generates migrations/000X_*.sql from server/db/schema.ts
pnpm db:migrate:local  # apply migrations to local D1
pnpm db:migrate:prod   # apply migrations to production D1 (CI normally does this)
```

Single test:

```bash
pnpm exec vitest run path/to/file.test.ts -t "name fragment"
pnpm exec vitest run --config vitest.workers.config.ts path/to/file.test.ts
pnpm exec playwright test specs/board-flow.spec.ts -g "name fragment"
pnpm exec playwright test --only-changed=origin/main   # what CI runs on PRs
```

Before declaring a task complete, run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:workers` — this is the project-mandated gate.

## Architecture (the parts that span multiple files)

**Runtime model.** The single Worker entry is `app/server.ts`. It mounts a `Hono<AppEnv>` app with global `sessionLoader` + `inertia({ rootView })` middleware, then composes route modules under `app/server/routes/*`. The exported handler also has `scheduled()` which runs `purgeExpired` (tied to the `0 3 * * *` cron in `wrangler.toml`).

**Inertia + SSR.** `root-view.tsx` renders the HTML shell with `<div id="app" data-page=...>`; the Worker calls `c.render('<name>', props)` and the `@hono/inertia` middleware fills in component+url. Client hydration lives in `app/client/client.tsx`. Page modules live in `app/pages/*.tsx` (kebab-case filenames) and are picked up by `inertiaPages()` in `vite.config.ts`, which writes `app/pages.gen.ts` (gitignored — `pnpm dev` or `pnpm build` regenerates it; needed for typecheck).

**Auth & sessions.** OAuth uses `arctic` via `server/auth/github-client.ts`. `server/auth/oauth-factory.ts` swaps in `FakeGitHubOAuthClient` when `E2E_AUTH=1` so Playwright can hit `/auth/github?login=…` and short-circuit through callback (see `tests/e2e/fixtures/session.ts`). Sessions are server-side rows (`sessions` table, 30-day TTL); `sessionLoader` populates `c.var.user` / `c.var.csrfToken`. Mutating routes must chain `requireAuth` (route-level `app.use('*', requireAuth)`) and `csrfGuard` (per-handler) — see `server/routes/projects.ts` for the canonical pattern. CSRF requires the `csrf` cookie + `X-CSRF-Token` header to both equal the session's csrfToken.

**Inertia auth redirects.** `requireAuth` returns `409 + X-Inertia-Location` for `X-Inertia` requests and a plain `302` otherwise. Don't replace this with a JSON 401.

**Data layer.** Drizzle ORM over D1. `server/db/schema.ts` is the source of truth — edits there require `pnpm db:generate` and the resulting SQL **must be committed**. Repositories under `server/db/repositories/*` enforce ownership: every `update*` / `delete*` / `move*` takes `ownerId` and joins through `projects.ownerId` so cross-tenant access returns `null`, which routes translate to `404 NotFound`. IDs are ULIDs (`server/db/ulid.ts`).

**Ordering.** Columns and tasks use a float `position` column. `server/lib/position.ts` implements midpoint insertion with a 1e-6 rebalance threshold; `moveTask` falls back to `rebalance()` (1..N renumbering inside the destination column) when the gap collapses. Don't introduce alternative ordering schemes.

**Path aliases** (mirrored in `tsconfig.json`, `vite.config.ts`, both vitest configs): `@/` → `app/`, `@server/`, `@client/`, `@shared/`. Use them in new code instead of long relative paths.

**Frontend stack.** React 19 + Inertia + Tailwind v4 + shadcn/ui (`components.json`, `style: new-york`, alias `@/components/ui`). DnD via `@dnd-kit`. Optimistic board updates live in `client/hooks/use-optimistic-board.ts`.

**PWA.** `vite-plugin-pwa` in `injectManifest` mode; SW source is `app/client/pwa/sw.ts`. `client/pwa/register.ts` is guarded by `import.meta.env.DEV` so `pnpm dev` does **not** register the SW — verify SW behaviour through `pnpm build && pnpm preview`.

## Test layering

| Layer | Config | Where | Notes |
|---|---|---|---|
| Client / pages | `vitest.config.ts` | `client/**/*.test.{ts,tsx}`, `pages/**/*.test.{ts,tsx}` | jsdom, 70% coverage gate. |
| Server | `vitest.workers.config.ts` | `server/**/*.test.ts` | Runs in `@cloudflare/vitest-pool-workers` with real D1 + migrations. 90% line / 85% branch gate. |
| E2E | `playwright.config.ts` | `tests/e2e/specs/*` | `fullyParallel`, single chromium project. CI runs `--only-changed` on PR; full suite before deploy. |

`server/_test-helpers.ts` exposes `applyMigrations()` and `createTestUser()` for the workers-pool tests; use it instead of poking D1 directly.

## Project-specific rules (must follow)

These live in `.claude/rules/` and apply to all changes:

**`react.md` — no manual memoization.** Do not use `useMemo`, `useCallback`, or `React.memo`. Don't add them in response to "new array/object identity" review feedback. Remove existing ones if you encounter them.

**`e2e.md` — semantic locators only.**
- **`data-testid` is forbidden** in both production code and Playwright tests. Don't add it; remove it when you find it.
- Locator priority: role + accessible name → label/placeholder → visible text → landmark role → (last resort) `aria-label` added to product code.
- Use Web-first assertions: `await expect(locator).toBeVisible()`. Never `expect(await locator.isVisible()).toBe(true)`.
- No `page.waitForTimeout()`. Rely on auto-waiting; for explicit waits use `waitForURL` / `locator.waitFor` / `waitForResponse`.
- Mock third-party HTTP with `page.route()`. Never call real external APIs from E2E. The auth flow already has the `E2E_AUTH=1` fake client — use the `authenticate(login)` fixture.
- Tests must be independent. Set up data per-test (e.g. via `test.beforeEach` or the `authenticate` fixture), don't share state across specs.

## Inertia page workflow

1. Create `app/pages/<kebab-name>.tsx` exporting a default React component.
2. Return it from a Hono handler with `return c.render('<kebab-name>', { ...buildSharedProps(c), ...props });` — `buildSharedProps` (in `server/inertia/share.ts`) supplies `auth`, `csrfToken`, `flash` and matches `SharedProps` in `shared/types.ts`.
3. `pages.gen.ts` regenerates on next dev/build. If typecheck fails because it's missing in CI, run `pnpm build` first.

## Deploy & secrets (summary; see `docs/deployment.md` + `docs/cicd.md`)

- Production deploy is automatic on `push` to `main` via `.github/workflows/deploy.yml` (E2E full → migrate prod → `wrangler deploy --env production`).
- Worker secrets are owned by Terraform (`cloudflare_workers_secret`). Don't `wrangler secret put` directly — it diverges state. If you must in an emergency, mirror the value into `terraform/terraform.tfvars` so the next apply is a no-op.
- Migrations are forward-only. For destructive schema changes use the three-step dance: compatible migration → code switch → cleanup migration. Document this in the PR.

## Things that commonly trip people up

- `wrangler.toml` ships with placeholder `database_id = "00000000-..."` for local D1. Real value comes from `wrangler d1 create task-app-local` and is per-developer; don't commit your local id.
- `pages.gen.ts` is gitignored. Type errors mentioning missing pages mean it hasn't been generated — run `pnpm dev` or `pnpm build` once.
- `E2E_AUTH=1` enables `POST /auth/test-login` and the fake OAuth client. It's stripped in production via Vite define / dead-code elimination — don't gate non-test logic on it.
- The only deploy artifact is `dist/client` (used by the Worker `ASSETS` binding). `pnpm test:workers` creates `dist/client` on its own so tests don't need a prior build.
