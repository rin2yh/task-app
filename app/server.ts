import { inertia } from '@hono/inertia';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { rootView } from './root-view';
import { sessionLoader } from './server/auth/middleware';
import { purgeExpired } from './server/auth/session';
import { createDb } from './server/db/client';
import type { AppEnv } from './server/env';
import { buildSharedProps } from './server/inertia/share';
import { authRoutes } from './server/routes/auth';
import { columnRoutes, columnsByProjectRoutes } from './server/routes/columns';
import { labelRoutes, labelsByProjectRoutes } from './server/routes/labels';
import { pageRoutes } from './server/routes/pages';
import { projectRoutes } from './server/routes/projects';
import { taskRoutes, tasksByColumnRoutes } from './server/routes/tasks';

const ASSETS_VERSION = '1';

const app = new Hono<AppEnv>();

app.use('*', sessionLoader);

app.use(
  '*',
  inertia({
    version: ASSETS_VERSION,
    rootView,
    share: (c) => buildSharedProps(c as never),
  } as never),
);

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
  async scheduled(_event: ScheduledEvent, env: AppEnv['Bindings']) {
    const db = createDb(env.DB);
    await purgeExpired(db);
  },
} satisfies ExportedHandler<AppEnv['Bindings']>;
