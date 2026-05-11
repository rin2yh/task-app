import { SYSTEM_COLUMN_NO_STATUS } from '@shared/column';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect } from 'vitest';
import {
  applyMigrations,
  createTestUser,
  ENV,
  type Fetch,
  it,
  type TestUser,
} from '../../../tests/helpers';
import { createDb } from '../../db/client';
import { projectColumns } from '../../db/schema';

async function createProject(fetch: Fetch, u: TestUser) {
  const res = await fetch('/projects', {
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

  it('creates new column appended to tail', async ({ fetch }) => {
    const u = await createTestUser('cu');
    const p = await createProject(fetch, u);
    const res = await fetch(`/projects/${p.id}/columns`, {
      method: 'POST',
      headers: {
        cookie: u.cookies,
        'X-CSRF-Token': u.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Backlog' }),
    });
    expect(res.status).toBe(201);
    const list = await fetch(`/projects/${p.id}/columns`, {
      headers: { cookie: u.cookies },
    });
    const body = (await list.json()) as { columns: Array<{ name: string; position: number }> };
    expect(body.columns.at(-1)?.name).toBe('Backlog');
  });

  it('reorders columns via midpoint', async ({ fetch }) => {
    const u = await createTestUser('reord');
    const p = await createProject(fetch, u);
    const list1 = (
      (await (
        await fetch(`/projects/${p.id}/columns`, {
          headers: { cookie: u.cookies },
        })
      ).json()) as {
        columns: Array<{ id: string; columnId: string; name: string; position: number }>;
      }
    ).columns;
    expect(list1.map((c) => c.name)).toEqual(['ステータスなし', 'Todo', 'In Progress', 'Done']);
    const userCols = list1.filter((c) => c.columnId !== SYSTEM_COLUMN_NO_STATUS);
    const [todo, , done] = userCols;
    if (!todo || !done) throw new Error('expected 3 user columns');
    const reorder = await fetch(`/columns/${done.id}/reorder`, {
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
      (await (
        await fetch(`/projects/${p.id}/columns`, {
          headers: { cookie: u.cookies },
        })
      ).json()) as { columns: Array<{ id: string; name: string }> }
    ).columns;
    const list2User = list2.filter((c) => c.name !== 'ステータスなし');
    expect(list2User[0]?.id).toBe(done.id);
  });

  it('triggers rebalance when positions collapse', async ({ fetch }) => {
    const u = await createTestUser('rb');
    const p = await createProject(fetch, u);
    const db = createDb(ENV.DB);
    const cols = await db.select().from(projectColumns).where(eq(projectColumns.projectId, p.id));
    expect(cols.length).toBe(4);
    const [c0, c1, c2, c3] = cols;
    if (!c0 || !c1 || !c2 || !c3) throw new Error('expected 4 project_columns');
    await db.update(projectColumns).set({ position: 1 }).where(eq(projectColumns.id, c0.id));
    await db
      .update(projectColumns)
      .set({ position: 1.0000000001 })
      .where(eq(projectColumns.id, c1.id));
    await db
      .update(projectColumns)
      .set({ position: 1.0000000002 })
      .where(eq(projectColumns.id, c2.id));
    await db
      .update(projectColumns)
      .set({ position: 1.0000000003 })
      .where(eq(projectColumns.id, c3.id));

    const re = await fetch(`/columns/${c3.id}/reorder`, {
      method: 'POST',
      headers: {
        cookie: u.cookies,
        'X-CSRF-Token': u.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ afterColumnId: c0.id }),
    });
    expect(re.status).toBe(200);
    const after = await db
      .select()
      .from(projectColumns)
      .where(eq(projectColumns.projectId, p.id))
      .orderBy(sql`position ASC`);
    expect(after.map((c) => c.position)).toEqual([1, 2, 3, 4]);
  });

  it('rejects deleting a system column', async ({ fetch }) => {
    const u = await createTestUser('sysdel');
    const p = await createProject(fetch, u);
    const list = (
      (await (
        await fetch(`/projects/${p.id}/columns`, {
          headers: { cookie: u.cookies },
        })
      ).json()) as { columns: Array<{ id: string; columnId: string }> }
    ).columns;
    const sys = list.find((c) => c.columnId === SYSTEM_COLUMN_NO_STATUS);
    if (!sys) throw new Error('expected a system column');
    const del = await fetch(`/columns/${sys.id}`, {
      method: 'DELETE',
      headers: { cookie: u.cookies, 'X-CSRF-Token': u.csrfToken },
    });
    expect(del.status).toBe(409);
  });
});
