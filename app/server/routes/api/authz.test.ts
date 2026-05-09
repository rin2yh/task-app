import { beforeEach, describe, expect } from 'vitest';
import { applyMigrations, createTestUser, it } from '../../../tests/helpers';

describe('authorization (cross-user access returns 404)', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('user B cannot access user A resources (404)', async ({ fetch }) => {
    const a = await createTestUser('alice');
    const b = await createTestUser('bob');

    // alice creates project
    const created = await fetch('/projects', {
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
    const get = await fetch(`/projects/${aProj.id}`, {
      headers: { cookie: b.cookies },
    });
    expect(get.status).toBe(404);

    const patch = await fetch(`/projects/${aProj.id}`, {
      method: 'PATCH',
      headers: {
        cookie: b.cookies,
        'X-CSRF-Token': b.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'hijack' }),
    });
    expect(patch.status).toBe(404);

    const del = await fetch(`/projects/${aProj.id}`, {
      method: 'DELETE',
      headers: { cookie: b.cookies, 'X-CSRF-Token': b.csrfToken },
    });
    expect(del.status).toBe(404);
  });
});
