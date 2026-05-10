import { Card, CardContent } from '@client/components/ui/card';
import { LabelChip } from '@client/features/labels/components/label-chip';
import { PriorityBadge } from '@client/features/priority/components/priority-select';
import { cn } from '@client/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskWithLabels } from '@shared/task';

interface Props {
  task: TaskWithLabels;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', columnId: task.columnId },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      className={cn('cursor-pointer transition-opacity', isDragging && 'opacity-40')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
      onClick={onClick}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <strong
            className="block min-w-0 flex-1 truncate text-sm font-semibold leading-snug"
            title={task.title}
          >
            {task.title}
          </strong>
          <PriorityBadge priority={task.priority} />
        </div>
        {task.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {task.labels.map((l) => (
              <LabelChip key={l.id} label={l} />
            ))}
          </div>
        ) : null}
        {task.dueDate ? (
          <div className="text-xs text-muted-foreground">
            期限: {new Date(task.dueDate).toLocaleDateString('ja-JP')}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
