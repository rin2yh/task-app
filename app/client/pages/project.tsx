import { Board } from '@client/features/board/components/board';
import { usePage } from '@inertiajs/react';
import type { Column } from '@shared/column';
import type { SharedProps } from '@shared/inertia';
import type { Label } from '@shared/label';
import type { Project as ProjectT } from '@shared/project';
import type { TaskWithLabels } from '@shared/task';

interface Props {
  project: ProjectT;
  columns: Column[];
  tasks: TaskWithLabels[];
  labels: Label[];
}

export default function Project({ project, columns, tasks, labels }: Props) {
  const { props: shared } = usePage<SharedProps>();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-primary hover:underline">
            ← 戻る
          </a>
          <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
        </div>
      </header>
      <Board
        projectId={project.id}
        columns={columns}
        tasks={tasks}
        labels={labels}
        csrfToken={shared.csrfToken}
      />
    </div>
  );
}
