import { Board } from '@client/features/board/components/board';
import { TaskList } from '@client/features/project/components/task-list';
import { type ProjectView, ViewSwitcher } from '@client/features/project/components/view-switcher';
import { Link, usePage } from '@inertiajs/react';
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

export default function Project({ project, columns, tasks, labels }: Props) {
  const { props: shared } = usePage<SharedProps>();
  const [view, setView] = useState<ProjectView>('board');

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="shrink-0 text-sm text-primary hover:underline">
            ← 戻る
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight">{project.name}</h1>
        </div>
      </header>
      <div className="border-b bg-card px-6 py-2">
        <ViewSwitcher value={view} onChange={setView} />
      </div>
      {view === 'board' ? (
        <Board
          projectId={project.id}
          columns={columns}
          tasks={tasks}
          labels={labels}
          csrfToken={shared.csrfToken}
        />
      ) : (
        <TaskList columns={columns} tasks={tasks} labels={labels} csrfToken={shared.csrfToken} />
      )}
    </div>
  );
}
