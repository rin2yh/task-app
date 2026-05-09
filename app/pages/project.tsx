import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Board } from '../client/components/board/board';
import type {
  Column,
  Label,
  Project as ProjectT,
  SharedProps,
  TaskWithLabels,
} from '../shared/types';

type Props = {
  project: ProjectT;
  columns: Column[];
  tasks: TaskWithLabels[];
  labels: Label[];
};

export default function Project({ project, columns, tasks, labels }: Props) {
  const { props: shared } = usePage<SharedProps>();
  const [newColumnName, setNewColumnName] = useState('');

  const addColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;
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
  };

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-primary hover:underline">
            ← 戻る
          </a>
          <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
        </div>
        <form onSubmit={addColumn} className="flex gap-2">
          <Input
            type="text"
            placeholder="新しい列名"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            maxLength={50}
            className="w-48"
          />
          <Button type="submit" variant="outline" size="sm">
            列追加
          </Button>
        </form>
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
