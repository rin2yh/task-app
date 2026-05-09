import { Hono } from 'hono';
import { z } from 'zod';
import { csrfGuard, requireAuthentication } from '../../auth/middleware';
import { createDb } from '../../db/client';
import {
  createLabel,
  deleteLabel,
  listLabelsForProject,
  updateLabel,
} from '../../db/repositories/labels';
import type { AppEnv } from '../../env';
import { NotFound } from '../../lib/errors';
import { parseJson } from '../../lib/validation';

const ColorRe = /^#[0-9a-fA-F]{6}$/;

const CreateInput = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(ColorRe),
});

const UpdateInput = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(ColorRe).optional(),
});

export const labelsByProjectRoutes = new Hono<AppEnv>();
labelsByProjectRoutes.use('*', requireAuthentication);

labelsByProjectRoutes.get('/:projectId/labels', async (c) => {
  const user = c.var.authUser;
  const projectId = c.req.param('projectId');
  const db = createDb(c.env.DB);
  const labels = await listLabelsForProject(db, projectId, user.id);
  if (!labels) throw NotFound();
  return c.json({ labels });
});

labelsByProjectRoutes.post('/:projectId/labels', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const projectId = c.req.param('projectId');
  const input = await parseJson(c, CreateInput);
  const db = createDb(c.env.DB);
  const label = await createLabel(db, projectId, user.id, input);
  if (!label) throw NotFound();
  return c.json({ label }, 201);
});

export const labelRoutes = new Hono<AppEnv>();
labelRoutes.use('*', requireAuthentication);

labelRoutes.patch('/:id', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const input = await parseJson(c, UpdateInput);
  const db = createDb(c.env.DB);
  const label = await updateLabel(db, id, user.id, input);
  if (!label) throw NotFound();
  return c.json({ label });
});

labelRoutes.delete('/:id', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const db = createDb(c.env.DB);
  const ok = await deleteLabel(db, id, user.id);
  if (!ok) throw NotFound();
  return c.json({ ok: true });
});
