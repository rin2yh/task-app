import { Button } from '@client/components/ui/button';
import { Card } from '@client/components/ui/card';
import { Input } from '@client/components/ui/input';
import { useAuthentication } from '@client/hooks/use-authentication';
import { Link, router, usePage } from '@inertiajs/react';
import type { SharedProps } from '@shared/inertia';
import type { Project } from '@shared/project';
import { useState } from 'react';

interface Props {
  projects: Project[];
}

export default function Dashboard({ projects }: Props) {
  const { props: shared } = usePage<SharedProps>();
  const { user } = useAuthentication();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = !busy && name.trim().length > 0;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
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
        />
        <Button type="submit" disabled={!canSubmit}>
          作成
        </Button>
      </form>

      <ul className="mt-4 space-y-2.5">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/projects/${p.id}`}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="p-4 transition-colors hover:bg-accent/50">
                <span className="font-medium text-primary">{p.name}</span>
                {p.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                ) : null}
              </Card>
            </Link>
          </li>
        ))}
        {projects.length === 0 ? (
          <li className="text-sm text-muted-foreground">まだプロジェクトがありません。</li>
        ) : null}
      </ul>
    </div>
  );
}
