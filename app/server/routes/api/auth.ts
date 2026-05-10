import { generateState, OAuth2RequestError } from 'arctic';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Result } from '../../../shared/result';
import { csrfGuard } from '../../auth/middleware';
import type { GitHubUser } from '../../auth/oauth/client';
import { createOAuthClient } from '../../auth/oauth/factory';
import {
  clearOAuthStateCookie,
  clearSessionCookies,
  createSession,
  deleteSession,
  setOAuthStateCookie,
  setSessionCookies,
} from '../../auth/session';
import { verifyTurnstileToken } from '../../auth/turnstile';
import { createDb } from '../../db/client';
import { users } from '../../db/schema';
import type { AppEnv } from '../../env';

const STATE_COOKIE = 'oauth-state';

export const authRoutes = new Hono<AppEnv>();

async function upsertUserByGithubId(
  db: ReturnType<typeof createDb>,
  profile: GitHubUser,
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
  const created = inserted[0];
  if (!created) throw new Error('failed to upsert user');
  return created.id;
}

authRoutes.post('/github', async (c) => {
  if (c.get('user')) return c.redirect('/dashboard');
  const form = await c.req.formData();
  const token = form.get('cf-turnstile-response')?.toString() ?? '';
  const remoteIp = c.req.header('cf-connecting-ip');
  const ok = await verifyTurnstileToken(c.env, token, remoteIp);
  if (!ok) return c.redirect('/auth/login?error=turnstile', 302);

  const login = form.get('login')?.toString();
  const client = createOAuthClient(c, { login });
  const state = generateState();
  const url = client.createAuthorizationURL(state, ['read:user']);
  setOAuthStateCookie(c, STATE_COOKIE, state);
  return c.redirect(url.toString(), 302);
});

authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const stored = getCookie(c, STATE_COOKIE);
  if (!code || !state || !stored || state !== stored) {
    return c.redirect('/auth/login?error=state', 302);
  }
  clearOAuthStateCookie(c, STATE_COOKIE);

  const client = createOAuthClient(c);
  const tokenResult = await Result.try(client.validateAuthorizationCode(code));
  if (!tokenResult.ok) {
    if (tokenResult.error instanceof OAuth2RequestError) {
      return c.redirect('/auth/login?error=oauth', 302);
    }
    throw tokenResult.error;
  }
  const ghUser = await client.fetchUser(tokenResult.value);

  const db = createDb(c.env.DB);
  const userId = await upsertUserByGithubId(db, ghUser);
  const session = await createSession(db, userId);
  setSessionCookies(c, session);
  return c.redirect('/dashboard', 302);
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
