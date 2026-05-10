import { Button } from '@client/components/ui/button';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Column as ColumnT } from '@shared/column';
import type { TaskWithLabels } from '@shared/task';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { TaskCard } from './task-card';

interface Props {
  column: ColumnT;
  tasks: TaskWithLabels[];
  deleting?: boolean;
  onCreateTask: (columnId: string) => void;
  onSelectTask: (task: TaskWithLabels) => void;
  onDeleteColumn: (columnId: string) => void;
}

export function Column({
  column,
  tasks,
  deleting,
  onCreateTask,
  onSelectTask,
  onDeleteColumn,
}: Props) {
  const { setNodeRef } = useDroppable({
    id: `col-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });
  return (
    <div className="flex w-80 shrink-0 flex-col gap-2 rounded-xl bg-secondary p-3">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{column.name}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={`列 ${column.name} を削除`}
          aria-busy={deleting}
          disabled={deleting}
          onClick={() => onDeleteColumn(column.id)}
        >
          {deleting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              削除中…
            </>
          ) : (
            <>
              <Trash2 className="size-3.5" />
              削除
            </>
          )}
        </Button>
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-10 flex-col gap-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => onSelectTask(t)} />
          ))}
        </div>
      </SortableContext>
      <Button type="button" variant="outline" size="sm" onClick={() => onCreateTask(column.id)}>
        <Plus className="size-3.5" />
        タスク追加
      </Button>
    </div>
  );
}
