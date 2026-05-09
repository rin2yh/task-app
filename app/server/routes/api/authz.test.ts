import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, createTestUser } from '../../_test-helpers';

describe('authorization (cross-user access returns 404)', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('user B cannot access user A resources (404)', async () => {
    const a = await createTestUser('alice');
    const b = await createTestUser('bob');

    // alice creates project
    const created = await SELF.fetch('http://localhost/projects', {
      method: 'POST',
      headers: {
        cookie: a.cookies,
        'X-CSRF-Token': a.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'private' }),
    });
    const aProj = ((await created.json()) as { project: { id: string } }).project;

    // bob attempts GET / PATCH / DELETE → 404 (not 403)
    const get = await SELF.fetch(`http://localhost/projects/${aProj.id}`, {
      headers: { cookie: b.cookies },
    });
    expect(get.status).toBe(404);

    const patch = await SELF.fetch(`http://localhost/projects/${aProj.id}`, {
      method: 'PATCH',
      headers: {
        cookie: b.cookies,
        'X-CSRF-Token': b.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'hijack' }),
    });
    expect(patch.status).toBe(404);

    const del = await SELF.fetch(`http://localhost/projects/${aProj.id}`, {
      method: 'DELETE',
      headers: { cookie: b.cookies, 'X-CSRF-Token': b.csrfToken },
    });
    expect(del.status).toBe(404);
  });
});
