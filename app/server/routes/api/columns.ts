import { Hono } from 'hono';
import { z } from 'zod';
import { csrfGuard, requireAuth } from '../../auth/middleware';
import { createDb } from '../../db/client';
import {
  createColumn,
  deleteColumn,
  listColumnsForProject,
  reorderColumn,
  updateColumn,
} from '../../db/repositories/columns';
import type { AppEnv } from '../../env';
import { NotFound } from '../../lib/errors';
import { parseJson } from '../../lib/validation';

const CreateInput = z.object({
  name: z.string().min(1).max(50),
});
const UpdateInput = z.object({
  name: z.string().min(1).max(50).optional(),
});
const ReorderInput = z.object({
  beforeColumnId: z.string().nullable().optional(),
  afterColumnId: z.string().nullable().optional(),
});

export const columnsByProjectRoutes = new Hono<AppEnv>();
columnsByProjectRoutes.use('*', requireAuth);

columnsByProjectRoutes.get('/:projectId/columns', async (c) => {
  const user = c.var.authUser;
  const projectId = c.req.param('projectId');
  const db = createDb(c.env.DB);
  const cols = await listColumnsForProject(db, projectId, user.id);
  if (!cols) throw NotFound();
  return c.json({ columns: cols });
});

columnsByProjectRoutes.post('/:projectId/columns', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const projectId = c.req.param('projectId');
  const input = await parseJson(c, CreateInput);
  const db = createDb(c.env.DB);
  const col = await createColumn(db, projectId, user.id, input);
  if (!col) throw NotFound();
  return c.json({ column: col }, 201);
});

export const columnRoutes = new Hono<AppEnv>();
columnRoutes.use('*', requireAuth);

columnRoutes.patch('/:id', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const input = await parseJson(c, UpdateInput);
  const db = createDb(c.env.DB);
  const col = await updateColumn(db, id, user.id, input);
  if (!col) throw NotFound();
  return c.json({ column: col });
});

columnRoutes.delete('/:id', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const db = createDb(c.env.DB);
  const ok = await deleteColumn(db, id, user.id);
  if (!ok) throw NotFound();
  return c.json({ ok: true });
});

columnRoutes.post('/:id/reorder', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const input = await parseJson(c, ReorderInput);
  const db = createDb(c.env.DB);
  const cols = await reorderColumn(db, id, user.id, input);
  if (!cols) throw NotFound();
  return c.json({ columns: cols });
});
