import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';

interface Props {
  projectId: string;
  csrfToken: string;
}

export function AddColumn({ projectId, csrfToken }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEditing(false);
    setName('');
  };

  const canSubmit = !busy && name.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const res = await fetch(`/projects/${projectId}/columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(`Failed to add column: ${res.status}`);
      reset();
      router.reload();
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setEditing(true)}
        className="flex h-12 w-80 shrink-0 items-center justify-start gap-2 rounded-xl bg-secondary/40 px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Plus className="size-4" />
        列を追加
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-80 shrink-0 flex-col gap-2 rounded-xl bg-secondary p-3"
    >
      <Input
        autoFocus
        type="text"
        placeholder="列名を入力"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            reset();
          }
        }}
        maxLength={50}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          追加
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}
