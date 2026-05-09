import { beforeEach, describe, expect } from 'vitest';
import { applyMigrations, createTestUser, type Fetch, it } from '../../../tests/helpers';

async function setup(fetch: Fetch) {
  const u = await createTestUser('tu');
  const headers = {
    cookie: u.cookies,
    'X-CSRF-Token': u.csrfToken,
    'content-type': 'application/json',
  };
  const proj = await fetch('/projects', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'p' }),
  });
  const projId = ((await proj.json()) as { project: { id: string } }).project.id;
  const cols = (
    (await (
      await fetch(`/projects/${projId}/columns`, {
        headers: { cookie: u.cookies },
      })
    ).json()) as { columns: Array<{ id: string }> }
  ).columns;
  const firstCol = cols[0];
  if (!firstCol) throw new Error('expected at least one column');
  return { u, headers, projId, cols, firstCol };
}

describe('tasks CRUD', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('creates, updates, and deletes a task', async ({ fetch }) => {
    const { headers, firstCol } = await setup(fetch);
    const create = await fetch(`/columns/${firstCol.id}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'first' }),
    });
    expect(create.status).toBe(201);
    const t = ((await create.json()) as { task: { id: string; title: string } }).task;
    expect(t.title).toBe('first');

    const patch = await fetch(`/tasks/${t.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: 'updated', priority: 'high' }),
    });
    expect(patch.status).toBe(200);
    const upd = ((await patch.json()) as { task: { title: string; priority: string } }).task;
    expect(upd.title).toBe('updated');
    expect(upd.priority).toBe('high');

    const del = await fetch(`/tasks/${t.id}`, {
      method: 'DELETE',
      headers,
    });
    expect(del.status).toBe(200);
  });

  it('rejects invalid priority', async ({ fetch }) => {
    const { headers, firstCol } = await setup(fetch);
    const create = await fetch(`/columns/${firstCol.id}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 't', priority: 'super-high' }),
    });
    expect(create.status).toBe(400);
  });
});
