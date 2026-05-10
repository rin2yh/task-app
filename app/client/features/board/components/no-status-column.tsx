import { Card, CardContent } from '@client/components/ui/card';
import { LabelChip } from '@client/features/labels/components/label-chip';
import { PriorityBadge } from '@client/features/priority/components/priority-select';
import type { TaskWithLabels } from '@shared/task';

interface Props {
  tasks: TaskWithLabels[];
  onSelectTask: (task: TaskWithLabels) => void;
}

export function NoStatusColumn({ tasks, onSelectTask }: Props) {
  return (
    <section
      aria-label="ステータスなし"
      className="flex w-80 shrink-0 flex-col gap-2 rounded-xl border border-dashed bg-muted/40 p-3"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">ステータスなし</h2>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </header>
      <div className="flex min-h-10 flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">所属する列がありません。</p>
        ) : (
          tasks.map((t) => (
            <Card
              key={t.id}
              role="button"
              tabIndex={0}
              aria-label={`タスク: ${t.title}`}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => onSelectTask(t)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTask(t);
                }
              }}
            >
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm font-semibold leading-snug">{t.title}</strong>
                  <PriorityBadge priority={t.priority} />
                </div>
                {t.labels.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {t.labels.map((l) => (
                      <LabelChip key={l.id} label={l} />
                    ))}
                  </div>
                ) : null}
                {t.dueDate ? (
                  <div className="text-xs text-muted-foreground">
                    期限: {new Date(t.dueDate).toLocaleDateString('ja-JP')}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
