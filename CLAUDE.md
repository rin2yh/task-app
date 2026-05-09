# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

- `app/` — Cloudflare Worker + Vite/React client. **All `pnpm` commands run here.**
- `terraform/` — D1 + Worker + secrets scaffolding (state lives outside the repo).
- `docs/` — `setup.md`, `development.md`, `deployment.md`, `cicd.md`.
- Toolchain pins: @mise.toml (bootstrap with `mise trust && mise install`).

## Commands

Scripts: @app/package.json. Run all `pnpm` commands inside `app/`. Single test: `pnpm exec vitest run <path> -t "name"` (add `--config vitest.workers.config.ts` for server tests). Project gate before declaring done: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:workers`.

## Architecture

- **Worker entry** `app/server/index.ts`: `Hono<AppEnv>` with global `sessionLoader` + `inertia({ rootView })`, JSON route modules under `server/routes/api/*`, SSR pages in `server/routes/pages.ts`. Also exports `scheduled()` running `purgeExpired` (cron `0 3 * * *`).
- **Inertia/SSR**: `c.render('<name>', props)` resolves to `app/pages/<name>.tsx` (kebab-case). `inertiaPages()` writes `pages.gen.ts` (gitignored — `pnpm dev`/`build` regenerates; needed for typecheck). Hydration in `client/client.tsx`. Always spread `buildSharedProps(c)` (from `server/inertia/share.ts`) into props.
- **Auth**: arctic + `server/auth/oauth/github-client.ts`; `server/auth/oauth/factory.ts` swaps `FakeGitHubOAuthClient` when `E2E_AUTH=1`. Server-side `sessions` (30d). Mutating routes chain `requireAuth` (router-level) + `csrfGuard` (per-handler). CSRF = `csrf` cookie + `X-CSRF-Token` header both equal session csrfToken. `requireAuth` returns 409 + `X-Inertia-Location` for Inertia, else 302 — don't replace with JSON 401.
- **Data**: Drizzle on D1; `server/db/schema.ts` is source of truth. Repos in `server/db/repositories/*` enforce ownership via `ownerId` joined through `projects.ownerId`; cross-tenant returns `null` → routes throw `NotFound`. IDs are ULIDs (`server/db/ulid.ts`).
- **Ordering**: float `position` column, midpoint insertion in `server/lib/position.ts` with 1e-6 rebalance threshold; `moveTask` falls back to 1..N `rebalance()` when gap collapses. Don't introduce alternate ordering schemes.
- **Aliases** (in `tsconfig.json`, `vite.config.ts`, both vitest configs): `@/` → `app/`, `@server/`, `@client/`, `@shared/`. Use them in new code.
- **Frontend**: React 19 + Inertia + Tailwind v4 + shadcn/ui (`new-york`, `@/components/ui`); `@dnd-kit`; optimistic board in `client/hooks/use-optimistic-board.ts`.
- **PWA**: `vite-plugin-pwa` injectManifest, SW at `client/pwa/sw.ts`. `register.ts` is `import.meta.env.DEV`-guarded — verify SW via `pnpm build && pnpm preview`.
- **Test helpers**: `tests/helpers.ts` (`applyMigrations`, `createTestUser`) instead of poking D1 directly.

