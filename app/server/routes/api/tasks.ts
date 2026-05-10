import { Hono } from 'hono';
import { z } from 'zod';
import { PrioritySchema } from '../../../shared/priority';
import { csrfGuard, requireAuthentication } from '../../auth/middleware';
import { createDb } from '../../db/client';
import {
  createTask,
  deleteTask,
  moveTask,
  setTaskLabels,
  updateTask,
} from '../../db/repositories/tasks';
import type { AppEnv } from '../../env';
import { NotFound } from '../../lib/errors';
import { parseJson } from '../../lib/validation';

const CreateInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).nullable().optional(),
  priority: PrioritySchema.optional(),
  dueDate: z.number().int().nullable().optional(),
});

const UpdateInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  priority: PrioritySchema.optional(),
  dueDate: z.number().int().nullable().optional(),
});

const MoveInput = z.object({
  toColumnId: z.string().min(1),
  beforeTaskId: z.string().nullable().optional(),
  afterTaskId: z.string().nullable().optional(),
});

const LabelsInput = z.object({
  labelIds: z.array(z.string()).max(50),
});

export const tasksByColumnRoutes = new Hono<AppEnv>();
tasksByColumnRoutes.use('*', requireAuthentication);

tasksByColumnRoutes.post('/:columnId/tasks', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const projectColumnId = c.req.param('columnId');
  const input = await parseJson(c, CreateInput);
  const db = createDb(c.env.DB);
  const task = await createTask(db, projectColumnId, user.id, input);
  if (!task) throw NotFound();
  return c.json({ task }, 201);
});

export const taskRoutes = new Hono<AppEnv>();
taskRoutes.use('*', requireAuthentication);

taskRoutes.patch('/:id', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const input = await parseJson(c, UpdateInput);
  const db = createDb(c.env.DB);
  const task = await updateTask(db, id, user.id, input);
  if (!task) throw NotFound();
  return c.json({ task });
});

taskRoutes.delete('/:id', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const db = createDb(c.env.DB);
  const ok = await deleteTask(db, id, user.id);
  if (!ok) throw NotFound();
  return c.json({ ok: true });
});

taskRoutes.post('/:id/move', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const input = await parseJson(c, MoveInput);
  const db = createDb(c.env.DB);
  const result = await moveTask(db, id, user.id, {
    toProjectColumnId: input.toColumnId,
    beforeTaskId: input.beforeTaskId,
    afterTaskId: input.afterTaskId,
  });
  if (!result) throw NotFound();
  return c.json(result);
});

taskRoutes.put('/:id/labels', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const input = await parseJson(c, LabelsInput);
  const db = createDb(c.env.DB);
  const labels = await setTaskLabels(db, id, user.id, input.labelIds);
  if (!labels) throw NotFound();
  return c.json({ labels });
});
