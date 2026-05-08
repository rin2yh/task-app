import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { Project, SharedProps } from '../shared/types';

type Props = { projects: Project[] };

export default function Dashboard({ projects }: Props) {
  const { props: shared } = usePage<SharedProps>();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': shared.csrfToken,
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
      router.reload();
      setName('');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': shared.csrfToken },
    });
    window.location.href = '/auth/login';
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>プロジェクト</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {shared.auth.user ? (
            <>
              <span>{shared.auth.user.login}</span>
              <button type="button" className="btn" onClick={logout}>
                ログアウト
              </button>
            </>
          ) : null}
        </div>
      </header>

      <form onSubmit={create} style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          placeholder="プロジェクト名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          作成
        </button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
        {projects.map((p) => (
          <li key={p.id} className="card" style={{ marginBottom: '0.6rem' }}>
            <a href={`/projects/${p.id}`}>{p.name}</a>
            {p.description ? (
              <p style={{ margin: '0.3rem 0 0', color: 'var(--c-muted)' }}>{p.description}</p>
            ) : null}
          </li>
        ))}
        {projects.length === 0 ? (
          <li style={{ color: 'var(--c-muted)' }}>まだプロジェクトがありません。</li>
        ) : null}
      </ul>
    </div>
  );
}
