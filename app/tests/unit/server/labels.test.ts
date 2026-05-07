import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, createTestUser } from './_helpers';

async function setup() {
  const u = await createTestUser('lab');
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
  const t = await SELF.fetch(`http://localhost/columns/${cols[0]!.id}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'task' }),
  });
  const taskId = ((await t.json()) as { task: { id: string } }).task.id;
  return { u, headers, projId, taskId };
}

describe('labels', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('CRUD lifecycle', async () => {
    const { u, headers, projId } = await setup();
    const create = await SELF.fetch(`http://localhost/projects/${projId}/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'bug', color: '#ff0000' }),
    });
    expect(create.status).toBe(201);
    const label = ((await create.json()) as { label: { id: string; name: string } }).label;
    const list = await SELF.fetch(`http://localhost/projects/${projId}/labels`, {
      headers: { cookie: u.cookies },
    });
    const body = (await list.json()) as { labels: Array<{ id: string }> };
    expect(body.labels.map((l) => l.id)).toContain(label.id);

    const patch = await SELF.fetch(`http://localhost/labels/${label.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ color: '#00ff00' }),
    });
    expect(patch.status).toBe(200);

    const del = await SELF.fetch(`http://localhost/labels/${label.id}`, {
      method: 'DELETE',
      headers,
    });
    expect(del.status).toBe(200);
  });

  it('rejects invalid color format', async () => {
    const { headers, projId } = await setup();
    const r = await SELF.fetch(`http://localhost/projects/${projId}/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'x', color: 'red' }),
    });
    expect(r.status).toBe(400);
  });

  it('attach and detach labels to a task', async () => {
    const { headers, projId, taskId } = await setup();
    const a = (
      (await (
        await SELF.fetch(`http://localhost/projects/${projId}/labels`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: 'a', color: '#111111' }),
        })
      ).json()) as { label: { id: string } }
    ).label;
    const b = (
      (await (
        await SELF.fetch(`http://localhost/projects/${projId}/labels`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: 'b', color: '#222222' }),
        })
      ).json()) as { label: { id: string } }
    ).label;
    const put = await SELF.fetch(`http://localhost/tasks/${taskId}/labels`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ labelIds: [a.id, b.id] }),
    });
    expect(put.status).toBe(200);
    const body = (await put.json()) as { labels: Array<{ id: string }> };
    expect(body.labels.map((l) => l.id).sort()).toEqual([a.id, b.id].sort());

    const detach = await SELF.fetch(`http://localhost/tasks/${taskId}/labels`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ labelIds: [] }),
    });
    expect(detach.status).toBe(200);
    const det = (await detach.json()) as { labels: unknown[] };
    expect(det.labels).toHaveLength(0);
  });
});
