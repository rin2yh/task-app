import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, createTestUser, ENV } from './_helpers';
import { createDb } from '../../../server/db/client';
import { columns } from '../../../server/db/schema';
import { eq, sql } from 'drizzle-orm';

async function createProject(u: Awaited<ReturnType<typeof createTestUser>>) {
  const res = await SELF.fetch('http://localhost/projects', {
    method: 'POST',
    headers: {
      cookie: u.cookies,
      'X-CSRF-Token': u.csrfToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: 'p' }),
  });
  return ((await res.json()) as { project: { id: string } }).project;
}

describe('columns CRUD + reorder', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('creates new column appended to tail', async () => {
    const u = await createTestUser('cu');
    const p = await createProject(u);
    const res = await SELF.fetch(`http://localhost/projects/${p.id}/columns`, {
      method: 'POST',
      headers: {
        cookie: u.cookies,
        'X-CSRF-Token': u.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Backlog' }),
    });
    expect(res.status).toBe(201);
    const list = await SELF.fetch(`http://localhost/projects/${p.id}/columns`, {
      headers: { cookie: u.cookies },
    });
    const body = (await list.json()) as { columns: Array<{ name: string; position: number }> };
    expect(body.columns.at(-1)?.name).toBe('Backlog');
  });

  it('reorders columns via midpoint', async () => {
    const u = await createTestUser('reord');
    const p = await createProject(u);
    const list1 = (
      (await (await SELF.fetch(`http://localhost/projects/${p.id}/columns`, {
        headers: { cookie: u.cookies },
      })).json()) as { columns: Array<{ id: string; name: string; position: number }> }
    ).columns;
    expect(list1.map((c) => c.name)).toEqual(['Todo', 'In Progress', 'Done']);
    // Done を Todo の前に置く（beforeColumnId = Todo）
    const todo = list1[0]!;
    const done = list1[2]!;
    const reorder = await SELF.fetch(`http://localhost/columns/${done.id}/reorder`, {
      method: 'POST',
      headers: {
        cookie: u.cookies,
        'X-CSRF-Token': u.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ afterColumnId: todo.id }),
    });
    expect(reorder.status).toBe(200);
    const list2 = (
      (await (await SELF.fetch(`http://localhost/projects/${p.id}/columns`, {
        headers: { cookie: u.cookies },
      })).json()) as { columns: Array<{ id: string; name: string }> }
    ).columns;
    expect(list2[0]?.id).toBe(done.id);
  });

  it('triggers rebalance when positions collapse', async () => {
    const u = await createTestUser('rb');
    const p = await createProject(u);
    const db = createDb(ENV.DB);
    // 強制的に position を非常に近い値にする
    const cols = await db.select().from(columns).where(eq(columns.projectId, p.id));
    expect(cols.length).toBe(3);
    await db.update(columns).set({ position: 1 }).where(eq(columns.id, cols[0]!.id));
    await db.update(columns).set({ position: 1.0000000001 }).where(eq(columns.id, cols[1]!.id));
    await db.update(columns).set({ position: 1.0000000002 }).where(eq(columns.id, cols[2]!.id));

    const re = await SELF.fetch(`http://localhost/columns/${cols[2]!.id}/reorder`, {
      method: 'POST',
      headers: {
        cookie: u.cookies,
        'X-CSRF-Token': u.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ afterColumnId: cols[0]!.id }),
    });
    expect(re.status).toBe(200);
    const after = await db
      .select()
      .from(columns)
      .where(eq(columns.projectId, p.id))
      .orderBy(sql`position ASC`);
    // 1..3 で再採番されていること
    expect(after.map((c) => c.position)).toEqual([1, 2, 3]);
  });
});
