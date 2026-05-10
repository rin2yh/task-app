import { beforeEach, describe, expect } from 'vitest';
import { applyMigrations, createTestUser, it } from '../../../tests/helpers';

describe('projects CRUD', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('creates, lists, updates, deletes a project', async ({ fetch }) => {
    const u = await createTestUser('alice');
    const headers = {
      cookie: u.cookies,
      'X-CSRF-Token': u.csrfToken,
      'content-type': 'application/json',
    };
    const create = await fetch('/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'My Project' }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { project: { id: string; name: string } };
    const id = created.project.id;

    const list = await fetch('/projects/', {
      headers: { cookie: u.cookies },
    });
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { projects: Array<{ id: string }> };
    expect(listed.projects.find((p) => p.id === id)).toBeTruthy();

    const patch = await fetch(`/projects/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Renamed' }),
    });
    expect(patch.status).toBe(200);

    const del = await fetch(`/projects/${id}`, {
      method: 'DELETE',
      headers,
    });
    expect(del.status).toBe(200);
  });

  it('default columns are created with project (no_status + 3 user)', async ({ fetch }) => {
    const u = await createTestUser('with-cols');
    const headers = {
      cookie: u.cookies,
      'X-CSRF-Token': u.csrfToken,
      'content-type': 'application/json',
    };
    const create = await fetch('/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Boards' }),
    });
    const created = (await create.json()) as { project: { id: string } };
    const id = created.project.id;
    const cols = await fetch(`/projects/${id}/columns`, {
      headers: { cookie: u.cookies },
    });
    expect(cols.status).toBe(200);
    const body = (await cols.json()) as { columns: Array<{ name: string; isSystem: boolean }> };
    expect(body.columns.map((c) => c.name)).toEqual([
      'ステータスなし',
      'Todo',
      'In Progress',
      'Done',
    ]);
    expect(body.columns.map((c) => c.isSystem)).toEqual([true, false, false, false]);
  });
});
