import { and, asc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import type { Database } from '../client';
import { labels, projects, type DbLabel } from '../schema';

async function ensureProjectOwned(
  db: Database,
  projectId: string,
  ownerId: number,
): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .limit(1);
  return rows.length > 0;
}

async function ownsLabel(
  db: Database,
  labelId: string,
  ownerId: number,
): Promise<DbLabel | null> {
  const rows = await db
    .select({ label: labels })
    .from(labels)
    .innerJoin(projects, eq(projects.id, labels.projectId))
    .where(and(eq(labels.id, labelId), eq(projects.ownerId, ownerId)))
    .limit(1);
  return rows[0]?.label ?? null;
}

export async function listLabelsForProject(
  db: Database,
  projectId: string,
  ownerId: number,
): Promise<DbLabel[] | null> {
  const ok = await ensureProjectOwned(db, projectId, ownerId);
  if (!ok) return null;
  return db.select().from(labels).where(eq(labels.projectId, projectId)).orderBy(asc(labels.name));
}

export async function createLabel(
  db: Database,
  projectId: string,
  ownerId: number,
  input: { name: string; color: string },
): Promise<DbLabel | null> {
  const ok = await ensureProjectOwned(db, projectId, ownerId);
  if (!ok) return null;
  const label: DbLabel = {
    id: ulid(),
    projectId,
    name: input.name,
    color: input.color,
  };
  await db.insert(labels).values(label);
  return label;
}

export async function updateLabel(
  db: Database,
  labelId: string,
  ownerId: number,
  patch: Partial<{ name: string; color: string }>,
): Promise<DbLabel | null> {
  const existing = await ownsLabel(db, labelId, ownerId);
  if (!existing) return null;
  const next: DbLabel = {
    ...existing,
    name: patch.name ?? existing.name,
    color: patch.color ?? existing.color,
  };
  await db
    .update(labels)
    .set({ name: next.name, color: next.color })
    .where(eq(labels.id, labelId));
  return next;
}

export async function deleteLabel(
  db: Database,
  labelId: string,
  ownerId: number,
): Promise<boolean> {
  const existing = await ownsLabel(db, labelId, ownerId);
  if (!existing) return false;
  await db.delete(labels).where(eq(labels.id, labelId));
  return true;
}
