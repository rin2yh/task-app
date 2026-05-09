# CLAUDE.md

## Layout

- `app/` — Cloudflare Worker + Vite/React. **Run pnpm here.**
- `terraform/` — D1 + Worker + secrets (state outside the repo).
- `docs/oauth.md` — GitHub OAuth setup.
- Toolchain: @mise.toml (`mise trust && mise install`).

## Commands

@app/package.json. Project gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:server`.

## Architecture

- **Inertia/SSR**: `c.render('<name>', props)` → `app/pages/<name>.tsx` (kebab-case); spread `buildSharedProps(c)`. Gitignored `pages.gen.ts` regen by `pnpm dev`/`build`, needed for typecheck.
- **Auth**: `server/auth/oauth/factory.ts` → `FakeGitHubOAuthClient` if `NODE_ENV==='test'` (DCE'd in prod). Mutations chain `requireAuth`+`csrfGuard`; CSRF = `csrf` cookie + `X-CSRF-Token` == session token. Unauth → 409 + `X-Inertia-Location` (Inertia) else 302; never JSON 401.
- **Data**: Drizzle/D1 (`server/db/schema.ts`); repos scope by `projects.ownerId` (cross-tenant → `null` → `NotFound`). ULIDs: `server/db/ulid.ts`.
- **Ordering**: float `position` midpoint (`server/lib/position.ts`, rebalance @ 1e-6); `moveTask` → `rebalance()` on collapse.
- **Aliases** (`tsconfig.json` + `config/vite.config.ts` + both vitest configs): `@/`→`app/`, `@server/`, `@client/`, `@shared/`.
- **Frontend**: React 19 + Inertia + Tailwind v4 + shadcn/ui (`new-york`, `@/components/ui`) + `@dnd-kit`; optimistic board `client/hooks/use-optimistic-board.ts`.
- **PWA**: `vite-plugin-pwa` injectManifest, SW `client/pwa/sw.ts`; `register.ts` DEV-only — verify via `pnpm build && pnpm preview`.
- **Cron**: `server/index.ts` `scheduled` → `purgeExpired` (`0 3 * * *`).
- **Tests**: `tests/helpers.ts` (`applyMigrations`, `createTestUser`); never touch D1 directly.
