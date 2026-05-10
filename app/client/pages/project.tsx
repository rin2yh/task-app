import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Board } from '@client/features/board/components/board';
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

export default function Project({ project, columns, tasks, labels }: Props) {
  const { props: shared } = usePage<SharedProps>();
  const [newColumnName, setNewColumnName] = useState('');
  const [busy, setBusy] = useState(false);

  const canAddColumn = !busy && newColumnName.trim().length > 0;

  const addColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddColumn) return;
    setBusy(true);
    try {
      const res = await fetch(`/projects/${project.id}/columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': shared.csrfToken,
        },
        body: JSON.stringify({ name: newColumnName.trim() }),
      });
      if (!res.ok) throw new Error(`Failed to add column: ${res.status}`);
      setNewColumnName('');
      router.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-primary hover:underline">
            ← 戻る
          </a>
          <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="ビュー切替" className="flex gap-2 text-sm">
            <a
              href={`/projects/${project.id}`}
              aria-current="page"
              className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
            >
              ボード
            </a>
            <a
              href={`/projects/${project.id}/tasks`}
              className="rounded-md border border-input bg-background px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              リスト
            </a>
          </nav>
          <form onSubmit={addColumn} className="flex gap-2">
            <Input
              type="text"
              placeholder="新しい列名"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              maxLength={50}
              className="w-48"
            />
            <Button type="submit" variant="outline" size="sm" disabled={!canAddColumn}>
              列追加
            </Button>
          </form>
        </div>
      </header>
      <Board columns={columns} tasks={tasks} labels={labels} csrfToken={shared.csrfToken} />
    </div>
  );
}
