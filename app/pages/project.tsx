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
    <div style={{ minHeight: '100vh' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.5rem',
          background: 'white',
          borderBottom: '1px solid var(--c-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="/">← 戻る</a>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>{project.name}</h1>
        </div>
        <form onSubmit={addColumn} style={{ display: 'flex', gap: '0.4rem' }}>
          <input
            type="text"
            placeholder="新しい列名"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            maxLength={50}
          />
          <button type="submit" className="btn">
            列追加
          </button>
        </form>
      </header>
      <Board columns={columns} tasks={tasks} labels={labels} csrfToken={shared.csrfToken} />
    </div>
  );
}
