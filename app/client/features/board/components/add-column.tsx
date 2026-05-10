import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Plus } from 'lucide-react';
import { useState } from 'react';

interface Props {
  onSubmit: (name: string) => Promise<void>;
}

export function AddColumn({ onSubmit }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEditing(false);
    setName('');
  };

  const trimmed = name.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !trimmed) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      reset();
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-80 shrink-0 items-center gap-2 rounded-xl bg-secondary/40 p-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Plus className="size-4" />
        列を追加
      </button>
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
        disabled={busy}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!trimmed} loading={busy} loadingText="追加中…">
          追加
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}
