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

describe('tasks bulk update', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  async function createTask(
    fetch: Fetch,
    headers: Record<string, string>,
    columnId: string,
    title: string,
  ): Promise<{ id: string }> {
    const res = await fetch(`/columns/${columnId}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title }),
    });
    return ((await res.json()) as { task: { id: string } }).task;
  }

  it('applies priority and due date to many tasks at once', async ({ fetch }) => {
    const { headers, firstCol } = await setup(fetch);
    const t1 = await createTask(fetch, headers, firstCol.id, 'a');
    const t2 = await createTask(fetch, headers, firstCol.id, 'b');
    const t3 = await createTask(fetch, headers, firstCol.id, 'c');

    const due = Date.parse('2026-06-01T00:00:00Z');
    const res = await fetch('/tasks/bulk', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        ids: [t1.id, t2.id, t3.id],
        patch: { priority: 'high', dueDate: due },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tasks: { id: string; priority: string; dueDate: number | null }[];
    };
    expect(body.tasks).toHaveLength(3);
    for (const t of body.tasks) {
      expect(t.priority).toBe('high');
      expect(t.dueDate).toBe(due);
    }
  });

  it('replaces labels across selected tasks', async ({ fetch }) => {
    const { headers, projId, firstCol } = await setup(fetch);
    const t1 = await createTask(fetch, headers, firstCol.id, 'a');
    const t2 = await createTask(fetch, headers, firstCol.id, 'b');
    const labelRes = await fetch(`/projects/${projId}/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'urgent', color: '#ff0000' }),
    });
    const label = ((await labelRes.json()) as { label: { id: string } }).label;

    const res = await fetch('/tasks/bulk', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ ids: [t1.id, t2.id], labelIds: [label.id] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tasks: { id: string; labels: { id: string }[] }[];
    };
    expect(body.tasks).toHaveLength(2);
    for (const t of body.tasks) {
      expect(t.labels.map((l) => l.id)).toEqual([label.id]);
    }
  });

  it('returns 404 if any id is not owned', async ({ fetch }) => {
    const { headers, firstCol } = await setup(fetch);
    const t1 = await createTask(fetch, headers, firstCol.id, 'a');

    const other = await createTestUser('intruder');
    const otherHeaders = {
      cookie: other.cookies,
      'X-CSRF-Token': other.csrfToken,
      'content-type': 'application/json',
    };
    const proj = await fetch('/projects', {
      method: 'POST',
      headers: otherHeaders,
      body: JSON.stringify({ name: 'p2' }),
    });
    const projId = ((await proj.json()) as { project: { id: string } }).project.id;
    const cols = (
      (await (
        await fetch(`/projects/${projId}/columns`, {
          headers: { cookie: other.cookies },
        })
      ).json()) as { columns: Array<{ id: string }> }
    ).columns;
    const otherCol = cols[0];
    if (!otherCol) throw new Error('expected column');
    const t2 = await createTask(fetch, otherHeaders, otherCol.id, 'b');

    const res = await fetch('/tasks/bulk', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ ids: [t1.id, t2.id], patch: { priority: 'low' } }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects empty patch and missing labelIds', async ({ fetch }) => {
    const { headers, firstCol } = await setup(fetch);
    const t1 = await createTask(fetch, headers, firstCol.id, 'a');
    const res = await fetch('/tasks/bulk', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ ids: [t1.id] }),
    });
    expect(res.status).toBe(400);
  });
});
