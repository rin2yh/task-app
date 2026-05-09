import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, createTestUser } from '../../tests/helpers';

describe('CSRF protection', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('rejects POST without CSRF header (403)', async () => {
    const u = await createTestUser('csrf');
    const res = await SELF.fetch('http://localhost/projects', {
      method: 'POST',
      headers: { cookie: u.cookies, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'p' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects when header != cookie', async () => {
    const u = await createTestUser('csrf2');
    const res = await SELF.fetch('http://localhost/projects', {
      method: 'POST',
      headers: {
        cookie: u.cookies,
        'X-CSRF-Token': 'wrong-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'p' }),
    });
    expect(res.status).toBe(403);
  });

  it('accepts when CSRF matches', async () => {
    const u = await createTestUser('csrf3');
    const res = await SELF.fetch('http://localhost/projects', {
      method: 'POST',
      headers: {
        cookie: u.cookies,
        'X-CSRF-Token': u.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'project' }),
    });
    expect(res.status).toBe(201);
  });
});
