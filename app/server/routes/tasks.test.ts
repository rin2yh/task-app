import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, createTestUser } from '../_test-helpers';

async function setup() {
  const u = await createTestUser('tu');
  const headers = {
    cookie: u.cookies,
    'X-CSRF-Token': u.csrfToken,
    'content-type': 'application/json',
  };
  const proj = await SELF.fetch('http://localhost/projects', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'p' }),
  });
  const projId = ((await proj.json()) as { project: { id: string } }).project.id;
  const cols = (
    (await (
      await SELF.fetch(`http://localhost/projects/${projId}/columns`, {
        headers: { cookie: u.cookies },
      })
    ).json()) as { columns: Array<{ id: string }> }
  ).columns;
  return { u, headers, projId, cols };
}

describe('tasks CRUD', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('creates, updates, and deletes a task', async () => {
    const { headers, cols } = await setup();
    const create = await SELF.fetch(`http://localhost/columns/${cols[0]!.id}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'first' }),
    });
    expect(create.status).toBe(201);
    const t = ((await create.json()) as { task: { id: string; title: string } }).task;
    expect(t.title).toBe('first');

    const patch = await SELF.fetch(`http://localhost/tasks/${t.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: 'updated', priority: 'high' }),
    });
    expect(patch.status).toBe(200);
    const upd = ((await patch.json()) as { task: { title: string; priority: string } }).task;
    expect(upd.title).toBe('updated');
    expect(upd.priority).toBe('high');

    const del = await SELF.fetch(`http://localhost/tasks/${t.id}`, {
      method: 'DELETE',
      headers,
    });
    expect(del.status).toBe(200);
  });

  it('rejects invalid priority', async () => {
    const { headers, cols } = await setup();
    const create = await SELF.fetch(`http://localhost/columns/${cols[0]!.id}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 't', priority: 'super-high' }),
    });
    expect(create.status).toBe(400);
  });
});
