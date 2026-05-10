import { Card } from '@client/components/ui/card';
import { TaskDialog } from '@client/features/board/components/task-dialog';
import { LabelChip } from '@client/features/labels/components/label-chip';
import { PriorityBadge } from '@client/features/priority/components/priority-select';
import { router, usePage } from '@inertiajs/react';
import type { Column } from '@shared/column';
import type { SharedProps } from '@shared/inertia';
import type { Label } from '@shared/label';
import type { Project as ProjectT } from '@shared/project';
import type { TaskWithLabels } from '@shared/task';
import { useState } from 'react';

interface Props {
  project: ProjectT;
  columns: Column[];
  tasks: TaskWithLabels[];
  labels: Label[];
}

export default function TaskList({ project, columns, tasks, labels }: Props) {
  const { props: shared } = usePage<SharedProps>();
  const [openTask, setOpenTask] = useState<TaskWithLabels | null>(null);

  const tasksByColumn = new Map<string, TaskWithLabels[]>();
  for (const c of columns) tasksByColumn.set(c.id, []);
  for (const t of tasks) {
    const list = tasksByColumn.get(t.columnId);
    if (list) list.push(t);
  }

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm text-primary hover:underline">
            ← 戻る
          </a>
          <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
        </div>
        <nav aria-label="ビュー切替" className="flex gap-2 text-sm">
          <a
            href={`/projects/${project.id}`}
            className="rounded-md border border-input bg-background px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            ボード
          </a>
          <a
            href={`/projects/${project.id}/tasks`}
            aria-current="page"
            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
          >
            リスト
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <h2 className="sr-only">タスク一覧</h2>
        {columns.length === 0 ? (
          <p className="text-sm text-muted-foreground">列がありません。</p>
        ) : null}
        {columns.map((c) => {
          const ts = tasksByColumn.get(c.id) ?? [];
          return (
            <section key={c.id} aria-labelledby={`col-${c.id}`}>
              <h3
                id={`col-${c.id}`}
                className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"
              >
                <span>{c.name}</span>
                <span className="text-xs">({ts.length})</span>
              </h3>
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
                        className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/50"
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
      </main>

      {openTask ? (
        <TaskDialog
          task={openTask}
          allLabels={labels}
          csrfToken={shared.csrfToken}
          onClose={() => setOpenTask(null)}
          onUpdated={() => {
            setOpenTask(null);
            router.reload();
          }}
          onDeleted={() => {
            setOpenTask(null);
            router.reload();
          }}
        />
      ) : null}
    </div>
  );
}
