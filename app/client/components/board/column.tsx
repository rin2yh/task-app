import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
  return (
    <div className="column" data-testid={`column-${column.id}`}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '0.95rem', margin: 0 }}>{column.name}</h2>
        <button
          type="button"
          className="btn btn-danger"
          aria-label={`列 ${column.name} を削除`}
          onClick={() => onDeleteColumn(column.id)}
        >
          削除
        </button>
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: 40 }}
        >
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => onSelectTask(t)} />
          ))}
        </div>
      </SortableContext>
      <button type="button" className="btn" onClick={() => onCreateTask(column.id)}>
        + タスク追加
      </button>
    </div>
  );
}
