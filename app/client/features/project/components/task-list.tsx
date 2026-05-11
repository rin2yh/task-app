import { Card } from '@client/components/ui/card';
import { TaskDialog } from '@client/features/board/components/task-dialog';
import { LabelChip } from '@client/features/labels/components/label-chip';
import { PriorityBadge } from '@client/features/priority/components/priority-select';
import { cn } from '@client/lib/utils';
import type { Column } from '@shared/column';
import type { Label } from '@shared/label';
import type { TaskWithLabels } from '@shared/task';
import { useState } from 'react';

interface Props {
  columns: Column[];
  tasks: TaskWithLabels[];
  labels: Label[];
  csrfToken: string;
}

export function TaskList({ columns, tasks: initialTasks, labels, csrfToken }: Props) {
  const [tasks, setTasks] = useState<TaskWithLabels[]>(initialTasks);
  const [openTask, setOpenTask] = useState<TaskWithLabels | null>(null);

  const tasksByColumn = new Map<string, TaskWithLabels[]>();
  for (const c of columns) tasksByColumn.set(c.id, []);
  for (const t of tasks) {
    const list = tasksByColumn.get(t.projectColumnId);
    if (list) list.push(t);
  }

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {columns.length === 0 ? (
          <p className="text-sm text-muted-foreground">列がありません。</p>
        ) : null}
        {columns.map((c) => {
          const ts = tasksByColumn.get(c.id) ?? [];
          return (
            <section key={c.id} aria-labelledby={`col-${c.id}`}>
              <h2 id={`col-${c.id}`} className="mb-2 text-sm font-semibold text-muted-foreground">
                {c.name} <span className="text-xs">({ts.length})</span>
              </h2>
              {ts.length === 0 ? (
                <p className="text-sm text-muted-foreground">タスクがありません。</p>
              ) : (
                <ul className="space-y-2">
                  {ts.map((t) => (
                    <li key={t.id}>
                      <Card
                        role="button"
                        tabIndex={0}
                        aria-label={`タスク: ${t.title}`}
                        className={cn(
                          'flex cursor-pointer flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/50',
                          c.isSystem && 'border-dashed',
                        )}
                        onClick={() => setOpenTask(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpenTask(t);
                          }
                        }}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="font-medium leading-snug">{t.title}</span>
                          {t.labels.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {t.labels.map((l) => (
                                <LabelChip key={l.id} label={l} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {t.dueDate ? (
                            <span>期限: {new Date(t.dueDate).toLocaleDateString('ja-JP')}</span>
                          ) : null}
                          <PriorityBadge priority={t.priority} />
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {openTask ? (
        <TaskDialog
          task={openTask}
          allLabels={labels}
          csrfToken={csrfToken}
          onClose={() => setOpenTask(null)}
          onUpdated={(t) => {
            setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)));
            setOpenTask(null);
          }}
          onDeleted={(t) => {
            setTasks((prev) => prev.filter((x) => x.id !== t.id));
            setOpenTask(null);
          }}
        />
      ) : null}
    </>
  );
}
