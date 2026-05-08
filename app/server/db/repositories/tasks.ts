import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Priority } from '../../../shared/types';
import { computeInsertPosition, rebalance, tailPosition } from '../../lib/position';
import type { Database } from '../client';
import { type DbLabel, type DbTask, columns, labels, projects, taskLabels, tasks } from '../schema';
import { ulid } from '../ulid';

async function ownsColumn(
  db: Database,
  columnId: string,
  ownerId: number,
): Promise<{ column: typeof columns.$inferSelect; projectId: string } | null> {
  const rows = await db
    .select({ column: columns })
    .from(columns)
    .innerJoin(projects, eq(projects.id, columns.projectId))
    .where(and(eq(columns.id, columnId), eq(projects.ownerId, ownerId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { column: row.column, projectId: row.column.projectId };
}

export async function ownsTask(
  db: Database,
  taskId: string,
  ownerId: number,
): Promise<{ task: DbTask; projectId: string } | null> {
  const rows = await db
    .select({ task: tasks, projectId: columns.projectId })
    .from(tasks)
    .innerJoin(columns, eq(columns.id, tasks.columnId))
    .innerJoin(projects, eq(projects.id, columns.projectId))
    .where(and(eq(tasks.id, taskId), eq(projects.ownerId, ownerId)))
    .limit(1);
  const row = rows[0];
  return row ? { task: row.task, projectId: row.projectId } : null;
}

export async function listTasksForProject(
  db: Database,
  projectId: string,
): Promise<(DbTask & { labels: DbLabel[] })[]> {
  const cols = await db
    .select({ id: columns.id })
    .from(columns)
    .where(eq(columns.projectId, projectId));
  const colIds = cols.map((c) => c.id);
  if (colIds.length === 0) return [];
  const allTasks = await db
    .select()
    .from(tasks)
    .where(inArray(tasks.columnId, colIds))
    .orderBy(asc(tasks.position));
  if (allTasks.length === 0) return [];
  const taskIds = allTasks.map((t) => t.id);
  const tlRows = await db
    .select({
      taskId: taskLabels.taskId,
      label: labels,
    })
    .from(taskLabels)
    .innerJoin(labels, eq(labels.id, taskLabels.labelId))
    .where(inArray(taskLabels.taskId, taskIds));
  const byTask = new Map<string, DbLabel[]>();
  for (const r of tlRows) {
    const arr = byTask.get(r.taskId) ?? [];
    arr.push(r.label);
    byTask.set(r.taskId, arr);
  }
  return allTasks.map((t) => ({ ...t, labels: byTask.get(t.id) ?? [] }));
}

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  priority?: Priority;
  dueDate?: number | null;
};

export async function createTask(
  db: Database,
  columnId: string,
  ownerId: number,
  input: CreateTaskInput,
): Promise<DbTask | null> {
  const owned = await ownsColumn(db, columnId, ownerId);
  if (!owned) return null;
  const all = await db
    .select()
    .from(tasks)
    .where(eq(tasks.columnId, columnId))
    .orderBy(asc(tasks.position));
  const maxPos = all.at(-1)?.position ?? null;
  const now = Date.now();
  const t: DbTask = {
    id: ulid(),
    columnId,
    title: input.title,
    description: input.description ?? null,
    priority: input.priority ?? 'medium',
    dueDate: input.dueDate ?? null,
    position: tailPosition(maxPos),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(tasks).values(t);
  return t;
}

export type UpdateTaskInput = Partial<{
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: number | null;
}>;

export async function updateTask(
  db: Database,
  taskId: string,
  ownerId: number,
  patch: UpdateTaskInput,
): Promise<DbTask | null> {
  const owned = await ownsTask(db, taskId, ownerId);
  if (!owned) return null;
  const next: DbTask = {
    ...owned.task,
    title: patch.title ?? owned.task.title,
    description: patch.description !== undefined ? patch.description : owned.task.description,
    priority: patch.priority ?? owned.task.priority,
    dueDate: patch.dueDate !== undefined ? patch.dueDate : owned.task.dueDate,
    updatedAt: Date.now(),
  };
  await db
    .update(tasks)
    .set({
      title: next.title,
      description: next.description,
      priority: next.priority,
      dueDate: next.dueDate,
      updatedAt: next.updatedAt,
    })
    .where(eq(tasks.id, taskId));
  return next;
}

export async function deleteTask(db: Database, taskId: string, ownerId: number): Promise<boolean> {
  const owned = await ownsTask(db, taskId, ownerId);
  if (!owned) return false;
  await db.delete(tasks).where(eq(tasks.id, taskId));
  return true;
}

export type MoveTaskInput = {
  toColumnId: string;
  beforeTaskId?: string | null;
  afterTaskId?: string | null;
};

export async function moveTask(
  db: Database,
  taskId: string,
  ownerId: number,
  input: MoveTaskInput,
): Promise<{ task: DbTask; tasksInColumn: DbTask[] } | null> {
  const owned = await ownsTask(db, taskId, ownerId);
  if (!owned) return null;
  const destOwned = await ownsColumn(db, input.toColumnId, ownerId);
  if (!destOwned) return null;
  if (destOwned.projectId !== owned.projectId) return null;

  const others = (
    await db
      .select()
      .from(tasks)
      .where(eq(tasks.columnId, input.toColumnId))
      .orderBy(asc(tasks.position))
  ).filter((t) => t.id !== taskId);
  const beforeIdx = input.beforeTaskId ? others.findIndex((t) => t.id === input.beforeTaskId) : -1;
  const afterIdx = input.afterTaskId ? others.findIndex((t) => t.id === input.afterTaskId) : -1;
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

  const now = Date.now();
  if (newPos == null) {
    const logical = others.slice();
    let insertAt: number;
    if (input.beforeTaskId) {
      insertAt = logical.findIndex((t) => t.id === input.beforeTaskId) + 1;
    } else if (input.afterTaskId) {
      insertAt = logical.findIndex((t) => t.id === input.afterTaskId);
    } else {
      insertAt = logical.length;
    }
    const movedTask: DbTask = {
      ...owned.task,
      columnId: input.toColumnId,
    };
    logical.splice(insertAt, 0, movedTask);
    const reb = rebalance(logical);
    for (const r of reb) {
      if (r.id === taskId) {
        await db
          .update(tasks)
          .set({ columnId: input.toColumnId, position: r.position, updatedAt: now })
          .where(eq(tasks.id, taskId));
      } else {
        await db.update(tasks).set({ position: r.position }).where(eq(tasks.id, r.id));
      }
    }
  } else {
    await db
      .update(tasks)
      .set({ columnId: input.toColumnId, position: newPos, updatedAt: now })
      .where(eq(tasks.id, taskId));
  }
  const updated = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]!;
  const tasksInColumn = await db
    .select()
    .from(tasks)
    .where(eq(tasks.columnId, input.toColumnId))
    .orderBy(asc(tasks.position));
  return { task: updated, tasksInColumn };
}

export async function setTaskLabels(
  db: Database,
  taskId: string,
  ownerId: number,
  labelIds: string[],
): Promise<DbLabel[] | null> {
  const owned = await ownsTask(db, taskId, ownerId);
  if (!owned) return null;
  // 全 label が同 project に属することを確認
  if (labelIds.length > 0) {
    const found = await db
      .select()
      .from(labels)
      .where(and(inArray(labels.id, labelIds), eq(labels.projectId, owned.projectId)));
    if (found.length !== labelIds.length) return null;
  }
  await db.delete(taskLabels).where(eq(taskLabels.taskId, taskId));
  if (labelIds.length > 0) {
    await db.insert(taskLabels).values(labelIds.map((labelId) => ({ taskId, labelId })));
  }
  if (labelIds.length === 0) return [];
  return db.select().from(labels).where(inArray(labels.id, labelIds));
}
