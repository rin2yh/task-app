import { and, asc, eq, max } from 'drizzle-orm';
import { isSystemColumn } from '../../../shared/column';
import {
  computeInsertPosition,
  REBALANCE_THRESHOLD,
  rebalance,
  tailPosition,
} from '../../lib/position';
import type { Database } from '../client';
import {
  type DbProjectColumn,
  projectColumns,
  projects,
  systemColumns,
  userColumns,
} from '../schema';
import { ulid } from '../ulid';

export interface ResolvedColumn {
  id: string;
  projectId: string;
  columnId: string;
  name: string;
  position: number;
}

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

async function loadProjectColumns(db: Database, projectId: string): Promise<ResolvedColumn[]> {
  const rows = await db
    .select({
      pc: projectColumns,
      userName: userColumns.name,
      systemName: systemColumns.name,
    })
    .from(projectColumns)
    .leftJoin(userColumns, eq(userColumns.id, projectColumns.columnId))
    .leftJoin(systemColumns, eq(systemColumns.id, projectColumns.columnId))
    .where(eq(projectColumns.projectId, projectId))
    .orderBy(asc(projectColumns.position));
  return rows.flatMap((r) => {
    const name = r.systemName ?? r.userName;
    if (name == null) return [];
    return [
      {
        id: r.pc.id,
        projectId: r.pc.projectId,
        columnId: r.pc.columnId,
        name,
        position: r.pc.position,
      },
    ];
  });
}

export async function listColumnsForProject(
  db: Database,
  projectId: string,
  ownerId: number,
): Promise<ResolvedColumn[] | null> {
  const ok = await ensureProjectOwned(db, projectId, ownerId);
  if (!ok) return null;
  return loadProjectColumns(db, projectId);
}

export interface CreateColumnInput {
  name: string;
}

export async function createColumn(
  db: Database,
  projectId: string,
  ownerId: number,
  input: CreateColumnInput,
): Promise<ResolvedColumn | null> {
  const ok = await ensureProjectOwned(db, projectId, ownerId);
  if (!ok) return null;
  const maxRow = await db
    .select({ value: max(projectColumns.position) })
    .from(projectColumns)
    .where(eq(projectColumns.projectId, projectId));
  const position = tailPosition(maxRow[0]?.value ?? null);
  const now = Date.now();
  const userColumnId = ulid();
  await db.insert(userColumns).values({
    id: userColumnId,
    ownerId,
    name: input.name,
    createdAt: now,
  });
  const projectColumnId = ulid();
  await db.insert(projectColumns).values({
    id: projectColumnId,
    projectId,
    columnId: userColumnId,
    position,
  });
  return {
    id: projectColumnId,
    projectId,
    columnId: userColumnId,
    name: input.name,
    position,
  };
}

interface ProjectColumnLookup {
  projectColumn: DbProjectColumn;
  userColumnId: string | null;
  name: string;
}

async function lookupProjectColumn(
  db: Database,
  projectColumnId: string,
  ownerId: number,
): Promise<ProjectColumnLookup | null> {
  const rows = await db
    .select({
      pc: projectColumns,
      userColumnId: userColumns.id,
      userName: userColumns.name,
      systemName: systemColumns.name,
    })
    .from(projectColumns)
    .innerJoin(projects, eq(projects.id, projectColumns.projectId))
    .leftJoin(userColumns, eq(userColumns.id, projectColumns.columnId))
    .leftJoin(systemColumns, eq(systemColumns.id, projectColumns.columnId))
    .where(and(eq(projectColumns.id, projectColumnId), eq(projects.ownerId, ownerId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const name = row.systemName ?? row.userName;
  if (name == null) return null;
  return {
    projectColumn: row.pc,
    userColumnId: row.userColumnId,
    name,
  };
}

export async function updateColumn(
  db: Database,
  projectColumnId: string,
  ownerId: number,
  patch: { name?: string },
): Promise<ResolvedColumn | null> {
  const found = await lookupProjectColumn(db, projectColumnId, ownerId);
  if (!found) return null;
  if (isSystemColumn({ columnId: found.projectColumn.columnId })) return null;
  const userColumnId = found.userColumnId;
  if (!userColumnId) return null;
  if (patch.name !== undefined) {
    await db.update(userColumns).set({ name: patch.name }).where(eq(userColumns.id, userColumnId));
  }
  return {
    id: found.projectColumn.id,
    projectId: found.projectColumn.projectId,
    columnId: found.projectColumn.columnId,
    name: patch.name ?? found.name,
    position: found.projectColumn.position,
  };
}

export async function deleteColumn(
  db: Database,
  projectColumnId: string,
  ownerId: number,
): Promise<{ ok: boolean; system: boolean }> {
  const found = await lookupProjectColumn(db, projectColumnId, ownerId);
  if (!found) return { ok: false, system: false };
  if (isSystemColumn({ columnId: found.projectColumn.columnId })) {
    return { ok: false, system: true };
  }
  await db.delete(projectColumns).where(eq(projectColumns.id, projectColumnId));
  if (found.userColumnId) {
    await db.delete(userColumns).where(eq(userColumns.id, found.userColumnId));
  }
  return { ok: true, system: false };
}

export interface ReorderColumnInput {
  beforeColumnId?: string | null;
  afterColumnId?: string | null;
}

export async function reorderColumn(
  db: Database,
  projectColumnId: string,
  ownerId: number,
  input: ReorderColumnInput,
): Promise<ResolvedColumn[] | null> {
  const found = await lookupProjectColumn(db, projectColumnId, ownerId);
  if (!found) return null;
  const projectId = found.projectColumn.projectId;
  const all = await db
    .select()
    .from(projectColumns)
    .where(eq(projectColumns.projectId, projectId))
    .orderBy(asc(projectColumns.position));
  const others = all.filter((c) => c.id !== projectColumnId);
  const beforeIdx = input.beforeColumnId
    ? others.findIndex((c) => c.id === input.beforeColumnId)
    : -1;
  const afterIdx = input.afterColumnId ? others.findIndex((c) => c.id === input.afterColumnId) : -1;
  const prevPos =
    beforeIdx >= 0
      ? (others[beforeIdx]?.position ?? null)
      : afterIdx > 0
        ? (others[afterIdx - 1]?.position ?? null)
        : null;
  const nextPos =
    afterIdx >= 0
      ? (others[afterIdx]?.position ?? null)
      : beforeIdx >= 0 && beforeIdx + 1 < others.length
        ? (others[beforeIdx + 1]?.position ?? null)
        : null;
  const maxPos = others.at(-1)?.position ?? 0;
  const newPos = computeInsertPosition(prevPos, nextPos, maxPos);
  const existingCollapsed = others.some((c, i) => {
    if (i === 0) return false;
    const prev = others[i - 1];
    return prev != null && c.position - prev.position < REBALANCE_THRESHOLD;
  });
  if (newPos == null || existingCollapsed) {
    const logical = others.slice();
    let insertAt: number;
    if (input.beforeColumnId) {
      insertAt = logical.findIndex((c) => c.id === input.beforeColumnId) + 1;
    } else if (input.afterColumnId) {
      insertAt = logical.findIndex((c) => c.id === input.afterColumnId);
    } else {
      insertAt = logical.length;
    }
    logical.splice(insertAt, 0, found.projectColumn);
    const reb = rebalance(logical);
    for (const r of reb) {
      await db
        .update(projectColumns)
        .set({ position: r.position })
        .where(eq(projectColumns.id, r.id));
    }
  } else {
    await db
      .update(projectColumns)
      .set({ position: newPos })
      .where(eq(projectColumns.id, projectColumnId));
  }
  return loadProjectColumns(db, projectId);
}
