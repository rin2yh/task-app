import type { Priority } from '@shared/priority';
import { and, asc, eq, inArray, max } from 'drizzle-orm';
import { computeInsertPosition, rebalance, tailPosition } from '../../lib/position';
import type { Database } from '../client';
import {
  type DbLabel,
  type DbTask,
  labels,
  projectColumns,
  projects,
  taskLabels,
  tasks,
} from '../schema';
import { ulid } from '../ulid';

async function ownsProjectColumn(
  db: Database,
  projectColumnId: string,
  ownerId: number,
): Promise<{ projectColumnId: string; projectId: string } | null> {
  const rows = await db
    .select({ pc: projectColumns })
    .from(projectColumns)
    .innerJoin(projects, eq(projects.id, projectColumns.projectId))
    .where(and(eq(projectColumns.id, projectColumnId), eq(projects.ownerId, ownerId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { projectColumnId: row.pc.id, projectId: row.pc.projectId };
}

async function ownsTask(
  db: Database,
  taskId: string,
  ownerId: number,
): Promise<{ task: DbTask; projectId: string } | null> {
  const rows = await db
    .select({ task: tasks, projectId: projectColumns.projectId })
    .from(tasks)
    .innerJoin(projectColumns, eq(projectColumns.id, tasks.projectColumnId))
    .innerJoin(projects, eq(projects.id, projectColumns.projectId))
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
    .select({ id: projectColumns.id })
    .from(projectColumns)
    .where(eq(projectColumns.projectId, projectId));
  const colIds = cols.map((c) => c.id);
  if (colIds.length === 0) return [];
  const allTasks = await db
    .select()
    .from(tasks)
    .where(inArray(tasks.projectColumnId, colIds))
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

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: Priority;
  dueDate?: number | null;
}

export async function createTask(
  db: Database,
  projectColumnId: string,
  ownerId: number,
  input: CreateTaskInput,
): Promise<DbTask | null> {
  const owned = await ownsProjectColumn(db, projectColumnId, ownerId);
  if (!owned) return null;
  const maxRow = await db
    .select({ value: max(tasks.position) })
    .from(tasks)
    .where(eq(tasks.projectColumnId, projectColumnId));
  const maxPos = maxRow[0]?.value ?? null;
  const now = Date.now();
  const t: DbTask = {
    id: ulid(),
    projectColumnId,
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

export interface MoveTaskInput {
  toColumnId: string;
  beforeTaskId?: string | null;
  afterTaskId?: string | null;
}

export async function moveTask(
  db: Database,
  taskId: string,
  ownerId: number,
  input: MoveTaskInput,
): Promise<{ task: DbTask; tasksInColumn: DbTask[] } | null> {
  const owned = await ownsTask(db, taskId, ownerId);
  if (!owned) return null;
  const destOwned = await ownsProjectColumn(db, input.toColumnId, ownerId);
  if (!destOwned) return null;
  if (destOwned.projectId !== owned.projectId) return null;

  const others = (
    await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectColumnId, input.toColumnId))
      .orderBy(asc(tasks.position))
  ).filter((t) => t.id !== taskId);
  const beforeIdx = input.beforeTaskId ? others.findIndex((t) => t.id === input.beforeTaskId) : -1;
  const afterIdx = input.afterTaskId ? others.findIndex((t) => t.id === input.afterTaskId) : -1;
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
      projectColumnId: input.toColumnId,
    };
    logical.splice(insertAt, 0, movedTask);
    const reb = rebalance(logical);
    const [first, ...rest] = reb.map((r) =>
      r.id === taskId
        ? db
            .update(tasks)
            .set({
              projectColumnId: input.toColumnId,
              position: r.position,
              updatedAt: now,
            })
            .where(eq(tasks.id, taskId))
        : db.update(tasks).set({ position: r.position }).where(eq(tasks.id, r.id)),
    );
    if (first) await db.batch([first, ...rest]);
  } else {
    await db
      .update(tasks)
      .set({ projectColumnId: input.toColumnId, position: newPos, updatedAt: now })
      .where(eq(tasks.id, taskId));
  }
  const updated = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0];
  if (!updated) return null;
  const tasksInColumn = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectColumnId, input.toColumnId))
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
