import type { Column } from '@shared/column';
import type { Task, TaskWithLabels } from '@shared/task';
import { useState } from 'react';

export interface BoardState {
  columns: Column[];
  tasksByColumn: Record<string, TaskWithLabels[]>;
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export function buildInitialState(columns: Column[], tasks: TaskWithLabels[]): BoardState {
  const sortedCols = [...columns].sort(byPosition);
  const tasksByColumn: Record<string, TaskWithLabels[]> = {};
  for (const col of sortedCols) tasksByColumn[col.id] = [];
  for (const t of tasks) {
    let bucket = tasksByColumn[t.projectColumnId];
    if (!bucket) {
      bucket = [];
      tasksByColumn[t.projectColumnId] = bucket;
    }
    bucket.push(t);
  }
  for (const id of Object.keys(tasksByColumn)) {
    tasksByColumn[id]?.sort(byPosition);
  }
  return { columns: sortedCols, tasksByColumn };
}

export function useOptimisticBoard(initial: BoardState) {
  const [state, setState] = useState(initial);

  const moveTaskLocal = (taskId: string, toColumnId: string, toIndex: number) => {
    setState((prev) => {
      const next: BoardState = {
        columns: prev.columns,
        tasksByColumn: { ...prev.tasksByColumn },
      };
      let moved: TaskWithLabels | undefined;
      for (const colId of Object.keys(next.tasksByColumn)) {
        const current = next.tasksByColumn[colId];
        if (!current) continue;
        const idx = current.findIndex((t) => t.id === taskId);
        if (idx >= 0) {
          const arr = [...current];
          moved = arr.splice(idx, 1)[0];
          next.tasksByColumn[colId] = arr;
          break;
        }
      }
      if (!moved) return prev;
      const dest = [...(next.tasksByColumn[toColumnId] ?? [])];
      const insertAt = Math.max(0, Math.min(toIndex, dest.length));
      dest.splice(insertAt, 0, { ...moved, projectColumnId: toColumnId });
      next.tasksByColumn[toColumnId] = dest;
      return next;
    });
  };

  const replaceTasksForColumnLocal = (columnId: string, tasks: Task[]) => {
    setState((prev) => {
      const existing = prev.tasksByColumn[columnId] ?? [];
      const labelsById = new Map(existing.map((t) => [t.id, t.labels]));
      const merged: TaskWithLabels[] = tasks.map((t) => ({
        ...t,
        labels: labelsById.get(t.id) ?? [],
      }));
      return {
        ...prev,
        tasksByColumn: { ...prev.tasksByColumn, [columnId]: merged },
      };
    });
  };

  const addColumnLocal = (column: Column) => {
    setState((prev) => ({
      columns: [...prev.columns, column].sort(byPosition),
      tasksByColumn: { ...prev.tasksByColumn, [column.id]: [] },
    }));
  };

  const removeColumnLocal = (columnId: string) => {
    setState((prev) => {
      const { [columnId]: _, ...rest } = prev.tasksByColumn;
      return {
        columns: prev.columns.filter((c) => c.id !== columnId),
        tasksByColumn: rest,
      };
    });
  };

  const reset = (s: BoardState) => setState(s);

  return {
    state,
    moveTaskLocal,
    replaceTasksForColumnLocal,
    addColumnLocal,
    removeColumnLocal,
    reset,
  };
}
