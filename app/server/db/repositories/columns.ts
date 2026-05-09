import { and, asc, eq } from 'drizzle-orm';
import {
  computeInsertPosition,
  REBALANCE_THRESHOLD,
  rebalance,
  tailPosition,
} from '../../lib/position';
import type { Database } from '../client';
import { columns, type DbColumn, projects } from '../schema';
import { ulid } from '../ulid';

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

export async function listColumnsForProject(
  db: Database,
  projectId: string,
  ownerId: number,
): Promise<DbColumn[] | null> {
  const ok = await ensureProjectOwned(db, projectId, ownerId);
  if (!ok) return null;
  return db
    .select()
    .from(columns)
    .where(eq(columns.projectId, projectId))
    .orderBy(asc(columns.position));
}

export interface CreateColumnInput {
  name: string;
  afterColumnId?: string | null;
}

export async function createColumn(
  db: Database,
  projectId: string,
  ownerId: number,
  input: CreateColumnInput,
): Promise<DbColumn | null> {
  const ok = await ensureProjectOwned(db, projectId, ownerId);
  if (!ok) return null;
  const all = await db
    .select()
    .from(columns)
    .where(eq(columns.projectId, projectId))
    .orderBy(asc(columns.position));
  const maxPos = all.at(-1)?.position ?? null;
  const position = tailPosition(maxPos);
  const now = Date.now();
  const col: DbColumn = {
    id: ulid(),
    projectId,
    name: input.name,
    position,
    createdAt: now,
  };
  await db.insert(columns).values(col);
  return col;
}

async function ownsColumn(
  db: Database,
  columnId: string,
  ownerId: number,
): Promise<DbColumn | null> {
  const rows = await db
    .select({ col: columns })
    .from(columns)
    .innerJoin(projects, eq(projects.id, columns.projectId))
    .where(and(eq(columns.id, columnId), eq(projects.ownerId, ownerId)))
    .limit(1);
  return rows[0]?.col ?? null;
}

export async function updateColumn(
  db: Database,
  columnId: string,
  ownerId: number,
  patch: { name?: string },
): Promise<DbColumn | null> {
  const existing = await ownsColumn(db, columnId, ownerId);
  if (!existing) return null;
  const next: DbColumn = { ...existing, name: patch.name ?? existing.name };
  await db.update(columns).set({ name: next.name }).where(eq(columns.id, columnId));
  return next;
}

export async function deleteColumn(
  db: Database,
  columnId: string,
  ownerId: number,
): Promise<boolean> {
  const existing = await ownsColumn(db, columnId, ownerId);
  if (!existing) return false;
  await db.delete(columns).where(eq(columns.id, columnId));
  return true;
}

export interface ReorderColumnInput {
  beforeColumnId?: string | null;
  afterColumnId?: string | null;
}

/**
 * 列の並び替え。midpoint で挿入位置決定、衝突時は当該プロジェクト内で全列リバランス。
 * 戻り値は新位置の columns 全件。
 */
export async function reorderColumn(
  db: Database,
  columnId: string,
  ownerId: number,
  input: ReorderColumnInput,
): Promise<DbColumn[] | null> {
  const target = await ownsColumn(db, columnId, ownerId);
  if (!target) return null;
  const all = await db
    .select()
    .from(columns)
    .where(eq(columns.projectId, target.projectId))
    .orderBy(asc(columns.position));
  const others = all.filter((c) => c.id !== columnId);
  const beforeIdx = input.beforeColumnId
    ? others.findIndex((c) => c.id === input.beforeColumnId)
    : -1;
  const afterIdx = input.afterColumnId ? others.findIndex((c) => c.id === input.afterColumnId) : -1;
  const prevPos =
    beforeIdx >= 0
      ? others[beforeIdx]!.position
      : afterIdx > 0
        ? others[afterIdx - 1]!.position
        : null;
  const nextPos =
    afterIdx >= 0
      ? others[afterIdx]!.position
      : beforeIdx >= 0 && beforeIdx + 1 < others.length
        ? others[beforeIdx + 1]!.position
        : null;
  const maxPos = others.at(-1)?.position ?? 0;
  const newPos = computeInsertPosition(prevPos, nextPos, maxPos);
  const existingCollapsed = others.some(
    (c, i) => i > 0 && c.position - others[i - 1]!.position < REBALANCE_THRESHOLD,
  );
  if (newPos == null || existingCollapsed) {
    // 全列リバランス：論理順に並べたうえで対象列を target index に配置
    const logical = others.slice();
    let insertAt: number;
    if (input.beforeColumnId) {
      insertAt = logical.findIndex((c) => c.id === input.beforeColumnId) + 1;
    } else if (input.afterColumnId) {
      insertAt = logical.findIndex((c) => c.id === input.afterColumnId);
    } else {
      insertAt = logical.length;
    }
    logical.splice(insertAt, 0, target);
    const reb = rebalance(logical);
    for (const r of reb) {
      await db.update(columns).set({ position: r.position }).where(eq(columns.id, r.id));
    }
  } else {
    await db.update(columns).set({ position: newPos }).where(eq(columns.id, columnId));
  }
  return db
    .select()
    .from(columns)
    .where(eq(columns.projectId, target.projectId))
    .orderBy(asc(columns.position));
}
