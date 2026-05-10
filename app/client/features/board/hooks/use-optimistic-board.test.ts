import type { Column } from '@shared/column';
import type { TaskWithLabels } from '@shared/task';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildInitialState, useOptimisticBoard } from './use-optimistic-board';

const cols: Column[] = [
  { id: 'c1', projectId: 'p', columnId: 'uc1', name: 'A', position: 1, isSystem: false },
  { id: 'c2', projectId: 'p', columnId: 'uc2', name: 'B', position: 2, isSystem: false },
];
const t = (id: string, projectColumnId: string, position: number): TaskWithLabels => ({
  id,
  projectColumnId,
  title: id,
  description: null,
  priority: 'medium',
  dueDate: null,
  position,
  createdAt: 0,
  updatedAt: 0,
  labels: [],
});

describe('useOptimisticBoard', () => {
  it('builds initial state grouped by column', () => {
    const init = buildInitialState(cols, [t('a', 'c1', 1), t('b', 'c1', 2), t('c', 'c2', 1)]);
    expect(init.tasksByColumn.c1?.map((x) => x.id)).toEqual(['a', 'b']);
    expect(init.tasksByColumn.c2?.map((x) => x.id)).toEqual(['c']);
  });

  it('moves a task locally', () => {
    const init = buildInitialState(cols, [t('a', 'c1', 1), t('b', 'c1', 2)]);
    const { result } = renderHook(() => useOptimisticBoard(init));
    act(() => {
      result.current.moveTaskLocal('a', 'c2', 0);
    });
    expect(result.current.state.tasksByColumn.c1?.map((x) => x.id)).toEqual(['b']);
    expect(result.current.state.tasksByColumn.c2?.map((x) => x.id)).toEqual(['a']);
  });

  it('replaceTasksForColumnLocal keeps labels', () => {
    const init = buildInitialState(cols, [
      { ...t('a', 'c1', 1), labels: [{ id: 'L', projectId: 'p', name: 'bug', color: '#fff000' }] },
    ]);
    const { result } = renderHook(() => useOptimisticBoard(init));
    act(() => {
      result.current.replaceTasksForColumnLocal('c1', [{ ...t('a', 'c1', 1.5) }]);
    });
    expect(result.current.state.tasksByColumn.c1?.[0]?.labels).toHaveLength(1);
  });

  it('addColumnLocal inserts in position order with an empty task bucket', () => {
    const init = buildInitialState(cols, []);
    const { result } = renderHook(() => useOptimisticBoard(init));
    act(() => {
      result.current.addColumnLocal({
        id: 'c-mid',
        projectId: 'p',
        columnId: 'uc-mid',
        name: 'Mid',
        position: 1.5,
        isSystem: false,
      });
    });
    expect(result.current.state.columns.map((c) => c.id)).toEqual(['c1', 'c-mid', 'c2']);
    expect(result.current.state.tasksByColumn['c-mid']).toEqual([]);
  });

  it('removeColumnLocal drops the column and its task bucket', () => {
    const init = buildInitialState(cols, [t('a', 'c1', 1), t('b', 'c2', 1)]);
    const { result } = renderHook(() => useOptimisticBoard(init));
    act(() => {
      result.current.removeColumnLocal('c1');
    });
    expect(result.current.state.columns.map((c) => c.id)).toEqual(['c2']);
    expect(result.current.state.tasksByColumn.c1).toBeUndefined();
  });
});
