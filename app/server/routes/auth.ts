import { OAuth2RequestError, generateState } from 'arctic';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { createGitHubProvider, fetchGitHubUser } from '../auth/github';
import { csrfGuard } from '../auth/middleware';
import {
  clearOAuthStateCookie,
  clearSessionCookies,
  createSession,
  deleteSession,
  setOAuthStateCookie,
  setSessionCookies,
} from '../auth/session';
import { createDb } from '../db/client';
import { users } from '../db/schema';
import type { AppEnv } from '../env';

const STATE_COOKIE = 'oauth-state';

export const authRoutes = new Hono<AppEnv>();

type GithubProfile = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

async function upsertUserByGithubId(
  db: ReturnType<typeof createDb>,
  profile: GithubProfile,
): Promise<number> {
  const existing = (
    await db.select().from(users).where(eq(users.githubId, profile.id)).limit(1)
  )[0];
  if (existing) {
    await db
      .update(users)
      .set({ login: profile.login, name: profile.name, avatarUrl: profile.avatar_url })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  const inserted = await db
    .insert(users)
    .values({
      githubId: profile.id,
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
      createdAt: Date.now(),
    })
    .returning();
  return inserted[0]!.id;
}

authRoutes.get('/github', async (c) => {
  if (c.get('user')) return c.redirect('/');
  const provider = createGitHubProvider(c.env);
  const state = generateState();
  const url = provider.createAuthorizationURL(state, ['read:user']);
  setOAuthStateCookie(c, STATE_COOKIE, state);
  return c.redirect(url.toString());
});

authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const stored = getCookie(c, STATE_COOKIE);
  if (!code || !state || !stored || state !== stored) {
    return c.redirect('/auth/login?error=state', 302);
  }
  clearOAuthStateCookie(c, STATE_COOKIE);

  const provider = createGitHubProvider(c.env);
  let accessToken: string;
  try {
    const tokens = await provider.validateAuthorizationCode(code);
    accessToken = tokens.accessToken();
  } catch (err) {
    if (err instanceof OAuth2RequestError) {
      return c.redirect('/auth/login?error=oauth', 302);
    }
    throw err;
  }
  const ghUser = await fetchGitHubUser(accessToken);

  const allowed = (c.env.ALLOWED_LOGINS ?? '').trim();
  if (
    allowed &&
    !allowed
      .split(',')
      .map((s) => s.trim())
      .includes(ghUser.login)
  ) {
    return c.redirect('/auth/login?error=forbidden', 302);
  }

  const db = createDb(c.env.DB);
  const userId = await upsertUserByGithubId(db, ghUser);
  const session = await createSession(db, userId);
  setSessionCookies(c, session);
  return c.redirect('/', 302);
});

authRoutes.post('/logout', csrfGuard, async (c) => {
  const token = c.get('sessionToken');
  if (token) {
    const db = createDb(c.env.DB);
    await deleteSession(db, token);
  }
  clearSessionCookies(c);
  if (c.req.header('X-Inertia')) {
    c.header('X-Inertia-Location', '/auth/login');
    return c.body(null, 409);
  }
  return c.redirect('/auth/login', 302);
});

// E2E のみ有効。本番では env.E2E_AUTH も env.ENVIRONMENT も 'test'/'1' になり得ないため 404 を返す。
authRoutes.post('/test-login', async (c) => {
  if (c.env.E2E_AUTH !== '1' && c.env.ENVIRONMENT !== 'test') {
    return c.notFound();
  }
  const body = await c.req.json<{ login: string; githubId?: number }>();
  const login = body.login;
  const githubId = body.githubId ?? Math.floor(Math.random() * 1_000_000) + 1;
  const db = createDb(c.env.DB);
  const userId = await upsertUserByGithubId(db, {
    id: githubId,
    login,
    name: login,
    avatar_url: null,
  });
  const session = await createSession(db, userId);
  setSessionCookies(c, session);
  return c.json({ ok: true, userId, csrfToken: session.csrfToken });
});
