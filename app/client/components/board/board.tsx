import { Button } from '@client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/components/ui/dialog';
import { Input } from '@client/components/ui/input';
import { Label as UiLabel } from '@client/components/ui/label';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Column as ColumnT, Label, TaskWithLabels } from '@shared/types';
import { useState } from 'react';
import { buildInitialState, useOptimisticBoard } from '../../hooks/use-optimistic-board';
import { Column } from './column';
import { TaskDialog } from './task-dialog';

type Props = {
  columns: ColumnT[];
  tasks: TaskWithLabels[];
  labels: Label[];
  csrfToken: string;
};

export function Board({ columns, tasks, labels, csrfToken }: Props) {
  const board = useOptimisticBoard(buildInitialState(columns, tasks));
  const [openTask, setOpenTask] = useState<TaskWithLabels | null>(null);
  const [creatingInColumn, setCreatingInColumn] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const jsonHeaders = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    let toColumnId = '';
    let toIndex = 0;
    if (overId.startsWith('col-')) {
      toColumnId = overId.slice(4);
      toIndex = (board.state.tasksByColumn[toColumnId] ?? []).length;
    } else {
      const overTaskCol = (over.data.current as { columnId?: string } | undefined)?.columnId;
      if (!overTaskCol) return;
      toColumnId = overTaskCol;
      const list = board.state.tasksByColumn[toColumnId] ?? [];
      toIndex = list.findIndex((t) => t.id === overId);
      if (toIndex < 0) toIndex = list.length;
    }

    const beforeIdx = toIndex - 1;
    const list = board.state.tasksByColumn[toColumnId] ?? [];
    const beforeTaskId =
      beforeIdx >= 0 && list[beforeIdx]?.id !== activeId ? (list[beforeIdx]?.id ?? null) : null;
    const afterTaskId = list[toIndex]?.id !== activeId ? (list[toIndex]?.id ?? null) : null;
    const snapshot = board.state;
    board.moveTaskLocal(activeId, toColumnId, toIndex);

    try {
      const res = await fetch(`/tasks/${activeId}/move`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ toColumnId, beforeTaskId, afterTaskId }),
      });
      if (!res.ok) throw new Error(`move failed: ${res.status}`);
      const data = (await res.json()) as { tasksInColumn?: TaskWithLabels[] };
      if (data.tasksInColumn) {
        board.replaceTasksForColumn(toColumnId, data.tasksInColumn);
      }
    } catch {
      board.reset(snapshot);
      alert('移動に失敗しました');
    }
  };

  const handleCreate = async (columnId: string, payload: { title: string }) => {
    const res = await fetch(`/columns/${columnId}/tasks`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`create failed: ${res.status}`);
    const data = (await res.json()) as { task: TaskWithLabels };
    const newTask: TaskWithLabels = { ...data.task, labels: [] };
    board.replaceTasksForColumn(columnId, [
      ...(board.state.tasksByColumn[columnId] ?? []),
      newTask,
    ]);
    setCreatingInColumn(null);
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="flex items-start gap-4 overflow-x-auto p-4">
          {board.state.columns.map((c) => (
            <Column
              key={c.id}
              column={c}
              tasks={board.state.tasksByColumn[c.id] ?? []}
              onCreateTask={(id) => setCreatingInColumn(id)}
              onSelectTask={setOpenTask}
              onDeleteColumn={async (id) => {
                if (!confirm('列を削除しますか？')) return;
                await fetch(`/columns/${id}`, {
                  method: 'DELETE',
                  headers: { 'X-CSRF-Token': csrfToken },
                });
                window.location.reload();
              }}
            />
          ))}
        </div>
      </DndContext>

      {openTask ? (
        <TaskDialog
          task={openTask}
          allLabels={labels}
          csrfToken={csrfToken}
          onClose={() => setOpenTask(null)}
          onUpdated={(t) => {
            board.replaceTasksForColumn(
              t.columnId,
              (board.state.tasksByColumn[t.columnId] ?? []).map((x) => (x.id === t.id ? t : x)),
            );
          }}
          onDeleted={(t) => {
            board.replaceTasksForColumn(
              t.columnId,
              (board.state.tasksByColumn[t.columnId] ?? []).filter((x) => x.id !== t.id),
            );
            setOpenTask(null);
          }}
        />
      ) : null}

      {creatingInColumn ? (
        <NewTaskDialog
          columnId={creatingInColumn}
          onCancel={() => setCreatingInColumn(null)}
          onSubmit={(payload) => handleCreate(creatingInColumn, payload)}
        />
      ) : null}
    </>
  );
}

function NewTaskDialog({
  columnId,
  onCancel,
  onSubmit,
}: {
  columnId: string;
  onCancel: () => void;
  onSubmit: (payload: { title: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新規タスク</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            setBusy(true);
            try {
              await onSubmit({ title: title.trim() });
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <UiLabel htmlFor={`new-task-title-${columnId}`}>タイトル</UiLabel>
            <Input
              id={`new-task-title-${columnId}`}
              type="text"
              placeholder="タイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
            <Button type="submit" disabled={busy}>
              作成
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
