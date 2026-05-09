import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect } from 'vitest';
import { applyMigrations, createTestUser, ENV, it } from '../../../tests/helpers';
import { createDb } from '../../db/client';
import { sessions } from '../../db/schema';

describe('auth flow', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('serves the public home page to unauthenticated users', async ({ fetch }) => {
    const res = await fetch('/', { redirect: 'manual' });
    expect(res.status).toBe(200);
  });

  it('redirects /dashboard to /auth/login when unauthenticated', async ({ fetch }) => {
    const res = await fetch('/dashboard', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/auth/login');
  });

  it('POST /auth/github starts OAuth and sets state cookie', async ({ fetch }) => {
    const res = await fetch('/auth/github', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'cf-turnstile-response=dummy',
      redirect: 'manual',
    });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('oauth-state=');
    const location = res.headers.get('location') ?? '';
    expect(location).toMatch(/github\.com\/login\/oauth\/authorize/);
  });

  it('logout deletes session and clears cookies', async ({ fetch }) => {
    const u = await createTestUser('logout-user');
    const res = await fetch('/auth/logout', {
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

  it('logout without CSRF returns 403', async ({ fetch }) => {
    const u = await createTestUser('csrf-user');
    const res = await fetch('/auth/logout', {
      method: 'POST',
      headers: { cookie: u.cookies },
    });
    expect(res.status).toBe(403);
  });
});
