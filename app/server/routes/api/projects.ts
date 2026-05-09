import { Hono } from 'hono';
import { z } from 'zod';
import { csrfGuard, requireAuthentication } from '../../auth/middleware';
import { createDb } from '../../db/client';
import {
  createProject,
  deleteProject,
  listProjectsByOwner,
  updateProject,
} from '../../db/repositories/projects';
import type { AppEnv } from '../../env';
import { NotFound } from '../../lib/errors';
import { parseJson } from '../../lib/validation';

const CreateInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).nullable().optional(),
});

const UpdateInput = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const projectRoutes = new Hono<AppEnv>();

projectRoutes.use('*', requireAuthentication);

projectRoutes.get('/', async (c) => {
  const user = c.var.authUser;
  const db = createDb(c.env.DB);
  const projects = await listProjectsByOwner(db, user.id);
  return c.json({ projects });
});

projectRoutes.post('/', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const input = await parseJson(c, CreateInput);
  const db = createDb(c.env.DB);
  const project = await createProject(db, user.id, input);
  return c.json({ project }, 201);
});

projectRoutes.patch('/:id', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const input = await parseJson(c, UpdateInput);
  const db = createDb(c.env.DB);
  const updated = await updateProject(db, id, user.id, input);
  if (!updated) throw NotFound();
  return c.json({ project: updated });
});

projectRoutes.delete('/:id', csrfGuard, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const db = createDb(c.env.DB);
  const ok = await deleteProject(db, id, user.id);
  if (!ok) throw NotFound();
  return c.json({ ok: true });
});
