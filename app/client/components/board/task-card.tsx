import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskWithLabels } from '../../../shared/types';
import { LabelChip } from '../shared/label-chip';
import { PriorityBadge } from '../shared/priority-select';

type Props = {
  task: TaskWithLabels;
  onClick: () => void;
};

export function TaskCard({ task, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', columnId: task.columnId },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // biome-ignore lint/a11y/useSemanticElements: dnd-kit の listeners は div に割り当てる前提のため button 化できない
      role="button"
      tabIndex={0}
      data-testid={`task-${task.id}`}
      className="card"
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
        <strong>{task.title}</strong>
        <PriorityBadge priority={task.priority} />
      </div>
      {task.labels.length > 0 ? (
        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
          {task.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      ) : null}
      {task.dueDate ? (
        <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--c-muted)' }}>
          期限: {new Date(task.dueDate).toLocaleDateString('ja-JP')}
        </div>
      ) : null}
    </div>
  );
}
