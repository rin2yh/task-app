import { Hono } from 'hono';
import { requireAuth, requireUser } from '../auth/middleware';
import { createDb } from '../db/client';
import { listColumnsForProject } from '../db/repositories/columns';
import { listLabelsForProject } from '../db/repositories/labels';
import { getProjectByIdForOwner, listProjectsByOwner } from '../db/repositories/projects';
import { listTasksForProject } from '../db/repositories/tasks';
import type { AppEnv } from '../env';
import { NotFound } from '../lib/errors';

export const pageRoutes = new Hono<AppEnv>();

pageRoutes.get('/auth/login', async (c) => {
  if (c.get('user')) return c.redirect('/');
  // @ts-expect-error - c.render is provided by @hono/inertia middleware
  return c.render('login', { error: c.req.query('error') ?? null });
});

pageRoutes.get('/', requireAuth, async (c) => {
  const user = requireUser(c);
  const db = createDb(c.env.DB);
  const projects = await listProjectsByOwner(db, user.id);
  // @ts-expect-error - c.render is provided by @hono/inertia middleware
  return c.render('dashboard', { projects });
});

pageRoutes.get('/projects/:id', requireAuth, async (c) => {
  const user = requireUser(c);
  const id = c.req.param('id');
  const db = createDb(c.env.DB);
  const project = await getProjectByIdForOwner(db, id, user.id);
  if (!project) throw NotFound();
  const [cols, tasksAll, labels] = await Promise.all([
    listColumnsForProject(db, id, user.id),
    listTasksForProject(db, id),
    listLabelsForProject(db, id, user.id),
  ]);
  // @ts-expect-error - c.render is provided by @hono/inertia middleware
  return c.render('project', {
    project,
    columns: cols ?? [],
    tasks: tasksAll,
    labels: labels ?? [],
  });
});
