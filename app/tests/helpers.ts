import { applyD1Migrations, env, SELF } from 'cloudflare:test';
import { sql } from 'drizzle-orm';
import { test as base } from 'vitest';
import { createSession } from '../server/auth/session';
import { createDb } from '../server/db/client';
import { users } from '../server/db/schema';

export const ENV = env as unknown as import('../server/env').Env & {
  TEST_MIGRATIONS?: D1Migration[];
};

export type Fetch = (path: string, init?: RequestInit) => Promise<Response>;

export const it = base.extend<{ fetch: Fetch }>({
  // biome-ignore lint/correctness/noEmptyPattern: vitest enforces a destructuring pattern for the fixtures arg
  fetch: async ({}, use) => {
    await use((path, init) => SELF.fetch(`http://localhost${path}`, init));
  },
});

export async function applyMigrations(): Promise<void> {
  const db = createDb(ENV.DB);
  // 既存テーブル削除（外部キー順）。何度でも初期化できるようにする。
  for (const t of [
    'task_labels',
    'labels',
    'tasks',
    'project_columns',
    'system_columns',
    'user_columns',
    'columns',
    'projects',
    'sessions',
    'users',
    'd1_migrations',
  ]) {
    await db.run(sql.raw(`DROP TABLE IF EXISTS \`${t}\``));
  }
  // vitest-pool-workers が migrations_dir からロードしたマイグレーションを適用
  if (ENV.TEST_MIGRATIONS) {
    await applyD1Migrations(ENV.DB, ENV.TEST_MIGRATIONS);
  }
}

// vitest-pool-workers の D1 migration 型（簡易）
interface D1Migration {
  name: string;
  queries: string[];
}

export interface TestUser {
  id: number;
  login: string;
  sessionToken: string;
  csrfToken: string;
  cookies: string;
}

export async function createTestUser(login: string): Promise<TestUser> {
  const db = createDb(ENV.DB);
  const githubId = Math.floor(Math.random() * 1_000_000) + 1;
  const inserted = await db
    .insert(users)
    .values({ githubId, login, name: login, avatarUrl: null, createdAt: Date.now() })
    .returning();
  const created = inserted[0];
  if (!created) throw new Error('failed to create test user');
  const userId = created.id;
  const session = await createSession(db, userId);
  const cookies = `session=${session.token}; csrf=${session.csrfToken}`;
  return {
    id: userId,
    login,
    sessionToken: session.token,
    csrfToken: session.csrfToken,
    cookies,
  };
}
