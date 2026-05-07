import { OAuth2RequestError, generateState } from 'arctic';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { createGitHubProvider, fetchGitHubUser } from '../auth/github';
import { csrfGuard } from '../auth/middleware';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  deleteSession,
} from '../auth/session';
import { createDb } from '../db/client';
import { users } from '../db/schema';
import type { AppEnv } from '../env';

const STATE_COOKIE = '__Host-oauth-state';

export const authRoutes = new Hono<AppEnv>();

authRoutes.get('/login', async (c) => {
  if (c.get('user')) return c.redirect('/');
  const provider = createGitHubProvider(c.env);
  const state = generateState();
  const url = provider.createAuthorizationURL(state, ['read:user']);
  setCookie(c, STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600,
  });
  return c.redirect(url.toString());
});

authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const stored = getCookie(c, STATE_COOKIE);
  if (!code || !state || !stored || state !== stored) {
    return c.redirect('/auth/login?error=state', 302);
  }
  setCookie(c, STATE_COOKIE, '', { path: '/', maxAge: 0, secure: true, httpOnly: true });

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
  const existing = (await db.select().from(users).where(eq(users.githubId, ghUser.id)).limit(1))[0];
  let userId: number;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({ login: ghUser.login, name: ghUser.name, avatarUrl: ghUser.avatar_url })
      .where(eq(users.id, existing.id));
  } else {
    const inserted = await db
      .insert(users)
      .values({
        githubId: ghUser.id,
        login: ghUser.login,
        name: ghUser.name,
        avatarUrl: ghUser.avatar_url,
        createdAt: Date.now(),
      })
      .returning();
    userId = inserted[0]!.id;
  }
  const session = await createSession(db, userId);
  setCookie(c, SESSION_COOKIE, session.token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_TTL_MS / 1000,
  });
  setCookie(c, CSRF_COOKIE, session.csrfToken, {
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return c.redirect('/', 302);
});

authRoutes.post('/logout', csrfGuard, async (c) => {
  const token = c.get('sessionToken');
  if (token) {
    const db = createDb(c.env.DB);
    await deleteSession(db, token);
  }
  setCookie(c, SESSION_COOKIE, '', { path: '/', maxAge: 0, secure: true, httpOnly: true });
  setCookie(c, CSRF_COOKIE, '', { path: '/', maxAge: 0, secure: true });
  if (c.req.header('X-Inertia')) {
    c.header('X-Inertia-Location', '/auth/login');
    return c.body(null, 409);
  }
  return c.redirect('/auth/login', 302);
});

// E2E バックドア: import.meta.env で dead-code elimination 想定。
// runtime check は ENVIRONMENT === 'test' or E2E_AUTH === '1' 時のみ。
authRoutes.post('/test-login', async (c) => {
  if (c.env.E2E_AUTH !== '1' && c.env.ENVIRONMENT !== 'test') {
    return c.notFound();
  }
  const body = await c.req.json<{ login: string; githubId?: number }>();
  const login = body.login;
  const githubId = body.githubId ?? Math.floor(Math.random() * 1_000_000) + 1;
  const db = createDb(c.env.DB);
  const existing = (await db.select().from(users).where(eq(users.githubId, githubId)).limit(1))[0];
  let userId: number;
  if (existing) {
    userId = existing.id;
  } else {
    const inserted = await db
      .insert(users)
      .values({ githubId, login, name: login, avatarUrl: null, createdAt: Date.now() })
      .returning();
    userId = inserted[0]!.id;
  }
  const session = await createSession(db, userId);
  setCookie(c, SESSION_COOKIE, session.token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_TTL_MS / 1000,
  });
  setCookie(c, CSRF_COOKIE, session.csrfToken, {
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return c.json({ ok: true, userId, csrfToken: session.csrfToken });
});
