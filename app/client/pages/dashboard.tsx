import { Button } from '@client/components/ui/button';
import { Card } from '@client/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/components/ui/dialog';
import { Input } from '@client/components/ui/input';
import { useAuthentication } from '@client/hooks/use-authentication';
import { Link, router, usePage } from '@inertiajs/react';
import type { SharedProps } from '@shared/inertia';
import type { Project } from '@shared/project';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  projects: Project[];
}

export default function Dashboard({ projects }: Props) {
  const { props: shared } = usePage<SharedProps>();
  const { user } = useAuthentication();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
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
                <span className="font-medium text-primary">{p.name}</span>
                {p.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                ) : null}
              </Link>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`プロジェクト ${p.name} の名前を変更`}
                  disabled={deletingId === p.id}
                  onClick={() => setRenameTarget(p)}
                >
                  <Pencil className="size-3.5" />
                </Button>
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
                </Button>
              </div>
            </Card>
          </li>
        ))}
        {projects.length === 0 ? (
          <li className="text-sm text-muted-foreground">まだプロジェクトがありません。</li>
        ) : null}
      </ul>

      {renameTarget ? (
        <RenameProjectDialog
          project={renameTarget}
          csrfToken={shared.csrfToken}
          onClose={() => setRenameTarget(null)}
        />
      ) : null}
    </div>
  );
}

interface RenameDialogProps {
  project: Project;
  csrfToken: string;
  onClose: () => void;
}

function RenameProjectDialog({ project, csrfToken, onClose }: RenameDialogProps) {
  const [draft, setDraft] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== project.name;

  // iOS Safari leaves the layout viewport pinned to the screen edge when the
  // soft keyboard opens; without this the bottom sheet hides behind it. The
  // inset latches to its peak so dismissing the keyboard doesn't collapse the
  // sheet back down mid-interaction.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset((prev) => Math.max(prev, Math.round(inset)));
    };
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !canSave) return;
    setBusy(true);
    try {
      const res = await fetch(`/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(`Failed to rename project: ${res.status}`);
      router.reload({ only: ['projects'] });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        style={{ '--kb-inset': `${keyboardInset}px` } as React.CSSProperties}
        className="sm:max-w-md max-sm:left-0 max-sm:top-auto max-sm:bottom-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:p-4 max-sm:pb-[calc(env(safe-area-inset-bottom,0px)+1rem+var(--kb-inset,0px))] max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom"
      >
        <div
          aria-hidden="true"
          className="mx-auto -mt-1 mb-1 h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden"
        />
        <DialogHeader>
          <DialogTitle>プロジェクト名を変更</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-3">
          <Input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={100}
            autoFocus
            aria-label="プロジェクト名"
            disabled={busy}
          />
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!canSave} loading={busy} loadingText="保存中…">
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
