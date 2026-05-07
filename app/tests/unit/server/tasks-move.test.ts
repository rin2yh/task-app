import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, createTestUser } from './_helpers';

async function setup() {
  const u = await createTestUser('mv');
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
    (await (await SELF.fetch(`http://localhost/projects/${projId}/columns`, {
      headers: { cookie: u.cookies },
    })).json()) as { columns: Array<{ id: string }> }
  ).columns;

  const created: Array<{ id: string; columnId: string }> = [];
  for (let i = 0; i < 3; i++) {
    const r = await SELF.fetch(`http://localhost/columns/${cols[0]!.id}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: `t${i}` }),
    });
    created.push(((await r.json()) as { task: { id: string; columnId: string } }).task);
  }
  return { u, headers, cols, created };
}

describe('tasks move (column-to-column + within-column)', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('moves a task to another column', async () => {
    const { headers, cols, created } = await setup();
    const r = await SELF.fetch(`http://localhost/tasks/${created[0]!.id}/move`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ toColumnId: cols[1]!.id }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { task: { columnId: string }; tasksInColumn: Array<{ id: string }> };
    expect(body.task.columnId).toBe(cols[1]!.id);
    expect(body.tasksInColumn.map((t) => t.id)).toContain(created[0]!.id);
  });

  it('reorders within the same column', async () => {
    const { headers, cols, created } = await setup();
    // 0番目を末尾に
    const r = await SELF.fetch(`http://localhost/tasks/${created[0]!.id}/move`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ toColumnId: cols[0]!.id, beforeTaskId: created[2]!.id }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { tasksInColumn: Array<{ id: string }> };
    expect(body.tasksInColumn.map((t) => t.id)).toEqual([
      created[1]!.id,
      created[2]!.id,
      created[0]!.id,
    ]);
  });

  it('cross-user move is rejected (404)', async () => {
    const { created } = await setup();
    const intruder = await createTestUser('intruder');
    const r = await SELF.fetch(`http://localhost/tasks/${created[0]!.id}/move`, {
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
