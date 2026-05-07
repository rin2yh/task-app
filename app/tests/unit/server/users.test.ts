import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb } from '../../../server/db/client';
import { users } from '../../../server/db/schema';
import { ENV, applyMigrations } from './_helpers';

describe('users table', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('inserts and selects a user', async () => {
    const db = createDb(ENV.DB);
    const inserted = await db
      .insert(users)
      .values({
        githubId: 1234,
        login: 'octo',
        name: 'Octo Cat',
        avatarUrl: 'https://example.com/a.png',
        createdAt: Date.now(),
      })
      .returning();
    expect(inserted[0]?.id).toBeTypeOf('number');

    const found = await db.select().from(users).where(eq(users.githubId, 1234));
    expect(found).toHaveLength(1);
    expect(found[0]?.login).toBe('octo');
  });

  it('enforces unique github_id', async () => {
    const db = createDb(ENV.DB);
    await db.insert(users).values({ githubId: 1, login: 'a', createdAt: Date.now() });
    await expect(
      db.insert(users).values({ githubId: 1, login: 'b', createdAt: Date.now() }),
    ).rejects.toBeTruthy();
  });
});
