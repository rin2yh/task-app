import { relations } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  githubId: integer('github_id').notNull().unique(),
  login: text('login').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at').notNull(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    token: text('token').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    csrfToken: text('csrf_token').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    expiresIdx: index('idx_sessions_expires').on(t.expiresAt),
    userIdx: index('idx_sessions_user').on(t.userId),
  }),
);

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    ownerId: integer('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    ownerIdx: index('idx_projects_owner').on(t.ownerId),
  }),
);

export const userColumns = sqliteTable(
  'user_columns',
  {
    id: text('id').primaryKey(),
    ownerId: integer('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    ownerIdx: index('idx_user_columns_owner').on(t.ownerId),
  }),
);

export const systemColumns = sqliteTable('system_columns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const projectColumns = sqliteTable(
  'project_columns',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    columnId: text('column_id').notNull(),
    position: real('position').notNull(),
  },
  (t) => ({
    projectPosIdx: index('idx_project_columns_project_pos').on(t.projectId, t.position),
  }),
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    projectColumnId: text('project_column_id')
      .notNull()
      .references(() => projectColumns.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    priority: text('priority').notNull().default('medium'),
    dueDate: integer('due_date'),
    position: real('position').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    columnPosIdx: index('idx_tasks_project_column_pos').on(t.projectColumnId, t.position),
  }),
);

export const labels = sqliteTable(
  'labels',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
  },
  (t) => ({
    projectIdx: index('idx_labels_project').on(t.projectId),
  }),
);

export const taskLabels = sqliteTable(
  'task_labels',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.taskId, t.labelId] }),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  projects: many(projects),
  userColumns: many(userColumns),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  projectColumns: many(projectColumns),
  labels: many(labels),
}));

export const userColumnsRelations = relations(userColumns, ({ one }) => ({
  owner: one(users, { fields: [userColumns.ownerId], references: [users.id] }),
}));

export const projectColumnsRelations = relations(projectColumns, ({ one, many }) => ({
  project: one(projects, { fields: [projectColumns.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  projectColumn: one(projectColumns, {
    fields: [tasks.projectColumnId],
    references: [projectColumns.id],
  }),
  taskLabels: many(taskLabels),
}));

export const labelsRelations = relations(labels, ({ one, many }) => ({
  project: one(projects, { fields: [labels.projectId], references: [projects.id] }),
  taskLabels: many(taskLabels),
}));

export const taskLabelsRelations = relations(taskLabels, ({ one }) => ({
  task: one(tasks, { fields: [taskLabels.taskId], references: [tasks.id] }),
  label: one(labels, { fields: [taskLabels.labelId], references: [labels.id] }),
}));

export type DbUser = typeof users.$inferSelect;
export type DbProject = typeof projects.$inferSelect;
export type DbUserColumn = typeof userColumns.$inferSelect;
export type DbSystemColumn = typeof systemColumns.$inferSelect;
export type DbProjectColumn = typeof projectColumns.$inferSelect;
export type DbTask = typeof tasks.$inferSelect;
export type DbLabel = typeof labels.$inferSelect;
