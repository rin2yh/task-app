import { Hono } from 'hono';
import { requireAuthentication } from '../auth/middleware';
import { createDb } from '../db/client';
import { listColumnsForProject } from '../db/repositories/columns';
import { listLabelsForProject } from '../db/repositories/labels';
import { getProjectByIdForOwner, listProjectsByOwner } from '../db/repositories/projects';
import { listTasksForProject } from '../db/repositories/tasks';
import type { AppEnv } from '../env';
import { buildSharedProps } from '../inertia/share';
import { NotFound } from '../lib/errors';

export const pageRoutes = new Hono<AppEnv>();

pageRoutes.get('/auth/login', async (c) => {
  if (c.get('user')) return c.redirect('/dashboard');
  return c.render('login', {
    ...buildSharedProps(c),
    error: c.req.query('error') ?? null,
  });
});

pageRoutes.get('/', async (c) => {
  if (c.get('user')) return c.redirect('/dashboard');
  return c.render('home', buildSharedProps(c));
});

pageRoutes.get('/dashboard', requireAuthentication, async (c) => {
  const user = c.var.authUser;
  const db = createDb(c.env.DB);
  const projects = await listProjectsByOwner(db, user.id);
  return c.render('dashboard', { ...buildSharedProps(c), projects });
});

pageRoutes.get('/projects/:id', requireAuthentication, async (c) => {
  const user = c.var.authUser;
  const id = c.req.param('id');
  const db = createDb(c.env.DB);
  const project = await getProjectByIdForOwner(db, id, user.id);
  if (!project) throw NotFound();
  const [cols, tasksAll, labels] = await Promise.all([
    listColumnsForProject(db, id, user.id),
    listTasksForProject(db, id),
    listLabelsForProject(db, id, user.id),
  ]);
  return c.render('project', {
    ...buildSharedProps(c),
    project,
    columns: cols ?? [],
    tasks: tasksAll,
    labels: labels ?? [],
  });
});
