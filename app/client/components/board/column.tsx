import { Button } from '@/components/ui/button';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { Column as ColumnT, TaskWithLabels } from '../../../shared/types';
import { TaskCard } from './task-card';

type Props = {
  column: ColumnT;
  tasks: TaskWithLabels[];
  onCreateTask: (columnId: string) => void;
  onSelectTask: (task: TaskWithLabels) => void;
  onDeleteColumn: (columnId: string) => void;
};

export function Column({ column, tasks, onCreateTask, onSelectTask, onDeleteColumn }: Props) {
  const { setNodeRef } = useDroppable({
    id: `col-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  return (
    <div
      className="flex w-80 shrink-0 flex-col gap-2 rounded-xl bg-secondary p-3"
      data-testid={`column-${column.id}`}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{column.name}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={`列 ${column.name} を削除`}
          onClick={() => onDeleteColumn(column.id)}
        >
          <Trash2 className="size-3.5" />
          削除
        </Button>
      </header>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
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
