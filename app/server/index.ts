import { inertia } from '@hono/inertia';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { rootView } from '../client/root-view';
import { sessionLoader } from './auth/middleware';
import { purgeExpired } from './auth/session';
import { createDb } from './db/client';
import type { AppEnv } from './env';
import { authRoutes } from './routes/auth';
import { columnRoutes, columnsByProjectRoutes } from './routes/columns';
import { labelRoutes, labelsByProjectRoutes } from './routes/labels';
import { pageRoutes } from './routes/pages';
import { projectRoutes } from './routes/projects';
import { taskRoutes, tasksByColumnRoutes } from './routes/tasks';

const ASSETS_VERSION = '1';

const app = new Hono<AppEnv>({ strict: false });

app.use('*', sessionLoader);

app.use('*', inertia({ version: ASSETS_VERSION, rootView }));

app.route('/auth', authRoutes);
app.route('/projects', projectRoutes);
app.route('/projects', columnsByProjectRoutes);
app.route('/projects', labelsByProjectRoutes);
app.route('/columns', columnRoutes);
app.route('/columns', tasksByColumnRoutes);
app.route('/labels', labelRoutes);
app.route('/tasks', taskRoutes);
app.route('/', pageRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: AppEnv['Bindings']) {
    const db = createDb(env.DB);
    await purgeExpired(db);
  },
} satisfies ExportedHandler<AppEnv['Bindings']>;
