import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Board } from '@client/features/board/components/board';
import { TaskList } from '@client/features/project/components/task-list';
import { type ProjectView, ViewSwitcher } from '@client/features/project/components/view-switcher';
import { Link, router, usePage } from '@inertiajs/react';
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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [renaming, setRenaming] = useState(false);

  const trimmedName = nameDraft.trim();
  const canSaveName = trimmedName.length > 0 && trimmedName !== project.name;

  const startRename = () => {
    setNameDraft(project.name);
    setEditingName(true);
  };

  const cancelRename = () => {
    setEditingName(false);
  };

  const saveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renaming || !canSaveName) return;
    setRenaming(true);
    try {
      const res = await fetch(`/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': shared.csrfToken,
        },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!res.ok) throw new Error(`Failed to rename project: ${res.status}`);
      setEditingName(false);
      router.reload({ only: ['project'] });
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-primary hover:underline">
            ← 戻る
          </Link>
          {editingName ? (
            <form onSubmit={saveRename} className="flex items-center gap-2">
              <Input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelRename();
                }}
                maxLength={100}
                autoFocus
                aria-label="プロジェクト名"
                className="w-64"
                disabled={renaming}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!canSaveName}
                loading={renaming}
                loadingText="保存中…"
              >
                保存
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelRename}
                disabled={renaming}
              >
                キャンセル
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={startRename}
                aria-label="プロジェクト名を変更"
              >
                名前変更
              </Button>
            </div>
          )}
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
