import { useState } from 'react';
import type { Column, Task, TaskWithLabels } from '../../shared/types';

export type BoardState = {
  columns: Column[];
  tasksByColumn: Record<string, TaskWithLabels[]>;
};

export function buildInitialState(columns: Column[], tasks: TaskWithLabels[]): BoardState {
  const sortedCols = [...columns].sort((a, b) => a.position - b.position);
  const tasksByColumn: Record<string, TaskWithLabels[]> = {};
  for (const col of sortedCols) tasksByColumn[col.id] = [];
  for (const t of tasks) {
    if (!tasksByColumn[t.columnId]) tasksByColumn[t.columnId] = [];
    tasksByColumn[t.columnId]!.push(t);
  }
  for (const id of Object.keys(tasksByColumn)) {
    tasksByColumn[id]!.sort((a, b) => a.position - b.position);
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
        const idx = next.tasksByColumn[colId]!.findIndex((t) => t.id === taskId);
        if (idx >= 0) {
          const arr = [...next.tasksByColumn[colId]!];
          moved = arr.splice(idx, 1)[0];
          next.tasksByColumn[colId] = arr;
          break;
        }
      }
      if (!moved) return prev;
      const dest = [...(next.tasksByColumn[toColumnId] ?? [])];
      const insertAt = Math.max(0, Math.min(toIndex, dest.length));
      dest.splice(insertAt, 0, { ...moved, columnId: toColumnId });
      next.tasksByColumn[toColumnId] = dest;
      return next;
    });
  };

  const replaceTasksForColumn = (columnId: string, tasks: Task[]) => {
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

  const reset = (s: BoardState) => setState(s);

  return { state, moveTaskLocal, replaceTasksForColumn, reset };
}
