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
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Column as ColumnT } from '@shared/column';
import type { Label } from '@shared/label';
import type { TaskWithLabels } from '@shared/task';
import { useState } from 'react';
import { buildInitialState, useOptimisticBoard } from '../hooks/use-optimistic-board';
import { AddColumn } from './add-column';
import { Column } from './column';
import { TaskDialog } from './task-dialog';

interface Props {
  projectId: string;
  columns: ColumnT[];
  tasks: TaskWithLabels[];
  labels: Label[];
  csrfToken: string;
}

export function Board({ projectId, columns, tasks, labels, csrfToken }: Props) {
  const board = useOptimisticBoard(buildInitialState(columns, tasks));
  const [openTask, setOpenTask] = useState<TaskWithLabels | null>(null);
  const [creatingInColumn, setCreatingInColumn] = useState<string | null>(null);
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
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
        board.replaceTasksForColumnLocal(toColumnId, data.tasksInColumn);
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
    board.replaceTasksForColumnLocal(columnId, [
      ...(board.state.tasksByColumn[columnId] ?? []),
      newTask,
    ]);
    setCreatingInColumn(null);
  };

  const handleCreateColumn = async (name: string) => {
    const res = await fetch(`/projects/${projectId}/columns`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`create column failed: ${res.status}`);
    const data = (await res.json()) as { column: ColumnT };
    board.addColumnLocal(data.column);
  };

  const handleDeleteColumn = async (id: string) => {
    if (deletingColumnId) return;
    if (!confirm('列を削除しますか？')) return;
    setDeletingColumnId(id);
    try {
      const res = await fetch(`/columns/${id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (!res.ok) throw new Error(`delete column failed: ${res.status}`);
      board.removeColumnLocal(id);
    } finally {
      setDeletingColumnId(null);
    }
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
              deleting={deletingColumnId === c.id}
              onCreateTask={(id) => setCreatingInColumn(id)}
              onSelectTask={setOpenTask}
              onDeleteColumn={handleDeleteColumn}
            />
          ))}
          <AddColumn onSubmit={handleCreateColumn} />
        </div>
      </DndContext>

      {openTask ? (
        <TaskDialog
          task={openTask}
          allLabels={labels}
          csrfToken={csrfToken}
          onClose={() => setOpenTask(null)}
          onUpdated={(t) => {
            board.replaceTasksForColumnLocal(
              t.columnId,
              (board.state.tasksByColumn[t.columnId] ?? []).map((x) => (x.id === t.id ? t : x)),
            );
          }}
          onDeleted={(t) => {
            board.replaceTasksForColumnLocal(
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
  const trimmed = title.trim();
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
            if (busy || !trimmed) return;
            setBusy(true);
            try {
              await onSubmit({ title: trimmed });
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
              disabled={busy}
            />
          </div>
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!trimmed} loading={busy} loadingText="作成中…">
              作成
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
