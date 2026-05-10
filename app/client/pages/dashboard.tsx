import { Button } from '@client/components/ui/button';
import { Card } from '@client/components/ui/card';
import { Input } from '@client/components/ui/input';
import { useAuthentication } from '@client/hooks/use-authentication';
import { Link, router, usePage } from '@inertiajs/react';
import type { SharedProps } from '@shared/inertia';
import type { Project } from '@shared/project';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  projects: Project[];
}

export default function Dashboard({ projects }: Props) {
  const { props: shared } = usePage<SharedProps>();
  const { user } = useAuthentication();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const trimmed = name.trim();

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !trimmed) return;
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
      router.reload({ only: ['projects'] });
      setName('');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`プロジェクト「${name}」を削除しますか？`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/projects/${id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': shared.csrfToken },
      });
      if (!res.ok) throw new Error(`Failed to delete project: ${res.status}`);
      router.reload({ only: ['projects'] });
    } finally {
      setDeletingId(null);
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
    <div className="mx-auto max-w-5xl p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">プロジェクト</h1>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">{user.login}</span>
              <Button type="button" variant="outline" size="sm" onClick={logout}>
                ログアウト
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <form onSubmit={create} className="mt-6 flex gap-2">
        <Input
          type="text"
          placeholder="プロジェクト名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          disabled={busy}
        />
        <Button type="submit" disabled={!trimmed} loading={busy} loadingText="作成中…">
          作成
        </Button>
      </form>

      <ul className="mt-4 space-y-2.5">
        {projects.map((p) => (
          <li key={p.id}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-accent/50">
              <Link
                href={`/projects/${p.id}`}
                className="min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block truncate font-medium text-primary">{p.name}</span>
                {p.description ? (
                  <p className="mt-1 truncate text-sm text-muted-foreground">{p.description}</p>
                ) : null}
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                aria-label={`プロジェクト ${p.name} を削除`}
                loading={deletingId === p.id}
                loadingText="削除中…"
                onClick={() => remove(p.id, p.name)}
              >
                <Trash2 className="size-3.5" />
                削除
              </Button>
            </Card>
          </li>
        ))}
        {projects.length === 0 ? (
          <li className="text-sm text-muted-foreground">まだプロジェクトがありません。</li>
        ) : null}
      </ul>
    </div>
  );
}
