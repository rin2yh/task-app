import { SYSTEM_COLUMN_NO_STATUS } from '@shared/column';
import { and, asc, eq } from 'drizzle-orm';
import { POSITION_STEP } from '../../lib/position';
import type { Database } from '../client';
import { type DbProject, projectColumns, projects, userColumns } from '../schema';
import { ulid } from '../ulid';

export async function listProjectsByOwner(db: Database, ownerId: number): Promise<DbProject[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .orderBy(asc(projects.createdAt));
}

export async function getProjectByIdForOwner(
  db: Database,
  id: string,
  ownerId: number,
): Promise<DbProject | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
}

export async function createProject(
  db: Database,
  ownerId: number,
  input: CreateProjectInput,
): Promise<DbProject> {
  const id = ulid();
  const now = Date.now();
  const project: DbProject = {
    id,
    ownerId,
    name: input.name,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const defaults = ['Todo', 'In Progress', 'Done'];
  const userColumnRows = defaults.map((name) => ({
    id: ulid(),
    ownerId,
    name,
    createdAt: now,
  }));
  const projectColumnRows = [
    { id: ulid(), projectId: id, columnId: SYSTEM_COLUMN_NO_STATUS, position: POSITION_STEP },
    ...userColumnRows.map((u, i) => ({
      id: ulid(),
      projectId: id,
      columnId: u.id,
      position: (i + 2) * POSITION_STEP,
    })),
  ];
  await db.batch([
    db.insert(projects).values(project),
    db.insert(userColumns).values(userColumnRows),
    db.insert(projectColumns).values(projectColumnRows),
  ]);
  return project;
}

export async function updateProject(
  db: Database,
  id: string,
  ownerId: number,
  patch: Partial<CreateProjectInput>,
): Promise<DbProject | null> {
  const existing = await getProjectByIdForOwner(db, id, ownerId);
  if (!existing) return null;
  const updated: DbProject = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description !== undefined ? patch.description : existing.description,
    updatedAt: Date.now(),
  };
  await db
    .update(projects)
    .set({
      name: updated.name,
      description: updated.description,
      updatedAt: updated.updatedAt,
    })
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)));
  return updated;
}

export async function deleteProject(db: Database, id: string, ownerId: number): Promise<boolean> {
  const existing = await getProjectByIdForOwner(db, id, ownerId);
  if (!existing) return false;
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)));
  return true;
}
