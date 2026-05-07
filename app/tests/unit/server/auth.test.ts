import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, createTestUser, ENV } from './_helpers';
import { createDb } from '../../../server/db/client';
import { eq } from 'drizzle-orm';
import { sessions } from '../../../server/db/schema';

describe('auth flow', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('redirects unauthenticated users to /auth/login', async () => {
    const res = await SELF.fetch('http://localhost/', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/auth/login');
  });

  it('GET /auth/login starts OAuth and sets state cookie', async () => {
    const res = await SELF.fetch('http://localhost/auth/login', { redirect: 'manual' });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('__Host-oauth-state=');
    const location = res.headers.get('location') ?? '';
    expect(location).toMatch(/github\.com\/login\/oauth\/authorize/);
  });

  it('test-login backdoor creates session', async () => {
    const res = await SELF.fetch('http://localhost/auth/test-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'tester' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; userId: number };
    expect(body.ok).toBe(true);
    expect(body.userId).toBeTypeOf('number');
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('__Host-session=');
    expect(setCookie).toContain('__Host-csrf=');
  });

  it('logout deletes session and clears cookies', async () => {
    const u = await createTestUser('logout-user');
    const res = await SELF.fetch('http://localhost/auth/logout', {
      method: 'POST',
      headers: {
        cookie: u.cookies,
        'X-CSRF-Token': u.csrfToken,
      },
      redirect: 'manual',
    });
    expect([302, 303, 200]).toContain(res.status);
    const db = createDb(ENV.DB);
    const remaining = await db.select().from(sessions).where(eq(sessions.token, u.sessionToken));
    expect(remaining).toHaveLength(0);
  });

  it('logout without CSRF returns 403', async () => {
    const u = await createTestUser('csrf-user');
    const res = await SELF.fetch('http://localhost/auth/logout', {
      method: 'POST',
      headers: { cookie: u.cookies },
    });
    expect(res.status).toBe(403);
  });
});
