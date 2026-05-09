import { beforeEach, describe, expect } from 'vitest';
import { applyMigrations, createTestUser, it } from '../../tests/helpers';

describe('CSRF protection', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('rejects POST without CSRF header (403)', async ({ fetch }) => {
    const u = await createTestUser('csrf');
    const res = await fetch('/projects', {
      method: 'POST',
      headers: { cookie: u.cookies, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'p' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects when header != cookie', async ({ fetch }) => {
    const u = await createTestUser('csrf2');
    const res = await fetch('/projects', {
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

  it('accepts when CSRF matches', async ({ fetch }) => {
    const u = await createTestUser('csrf3');
    const res = await fetch('/projects', {
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
