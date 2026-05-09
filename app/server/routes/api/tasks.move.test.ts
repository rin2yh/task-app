import { beforeEach, describe, expect } from 'vitest';
import { applyMigrations, createTestUser, type Fetch, it } from '../../../tests/helpers';

async function setup(fetch: Fetch) {
  const u = await createTestUser('mv');
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

  const [col0, col1] = cols;
  if (!col0 || !col1) throw new Error('expected at least 2 columns');
  const created: Array<{ id: string; columnId: string }> = [];
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`/columns/${col0.id}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: `t${i}` }),
    });
    created.push(((await r.json()) as { task: { id: string; columnId: string } }).task);
  }
  const [t0, t1, t2] = created;
  if (!t0 || !t1 || !t2) throw new Error('expected 3 tasks');
  return { u, headers, cols, col0, col1, created, t0, t1, t2 };
}

describe('tasks move (column-to-column + within-column)', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('moves a task to another column', async ({ fetch }) => {
    const { headers, col1, t0 } = await setup(fetch);
    const r = await fetch(`/tasks/${t0.id}/move`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ toColumnId: col1.id }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      task: { columnId: string };
      tasksInColumn: Array<{ id: string }>;
    };
    expect(body.task.columnId).toBe(col1.id);
    expect(body.tasksInColumn.map((t) => t.id)).toContain(t0.id);
  });

  it('reorders within the same column', async ({ fetch }) => {
    const { headers, col0, t0, t1, t2 } = await setup(fetch);
    // 0番目を末尾に
    const r = await fetch(`/tasks/${t0.id}/move`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ toColumnId: col0.id, beforeTaskId: t2.id }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { tasksInColumn: Array<{ id: string }> };
    expect(body.tasksInColumn.map((t) => t.id)).toEqual([t1.id, t2.id, t0.id]);
  });

  it('cross-user move is rejected (404)', async ({ fetch }) => {
    const { t0 } = await setup(fetch);
    const intruder = await createTestUser('intruder');
    const r = await fetch(`/tasks/${t0.id}/move`, {
      method: 'POST',
      headers: {
        cookie: intruder.cookies,
        'X-CSRF-Token': intruder.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ toColumnId: 'whatever' }),
    });
    expect(r.status).toBe(404);
  });
});
