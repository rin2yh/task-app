import { Button } from '@client/components/ui/button';
import { Checkbox } from '@client/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/components/ui/dialog';
import { Input } from '@client/components/ui/input';
import { Label as UiLabel } from '@client/components/ui/label';
import { Textarea } from '@client/components/ui/textarea';
import { LabelChip } from '@client/features/labels/components/label-chip';
import { PrioritySelect } from '@client/features/priority/components/priority-select';
import type { Label } from '@shared/label';
import type { Priority } from '@shared/priority';
import { tryAsync } from '@shared/result';
import type { TaskWithLabels } from '@shared/task';
import { useState } from 'react';

interface Props {
  task: TaskWithLabels;
  allLabels: Label[];
  csrfToken: string;
  onClose: () => void;
  onUpdated: (task: TaskWithLabels) => void;
  onDeleted: (task: TaskWithLabels) => void;
}

export function TaskDialog({ task, allLabels, csrfToken, onClose, onUpdated, onDeleted }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState<string>(
    task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
  );
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(
    new Set(task.labels.map((l) => l.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [busyOp, setBusyOp] = useState<'save' | 'remove' | null>(null);
  const busy = busyOp !== null;
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      setError('タイトル必須');
      return;
    }
    setError(null);
    setBusyOp('save');
    const result = await tryAsync(
      async () => {
        const payload = {
          title: title.trim(),
          description: description.length === 0 ? null : description,
          priority,
          dueDate: dueDate ? Date.parse(`${dueDate}T00:00:00Z`) : null,
        };
        const patchRes = await fetch(`/tasks/${task.id}`, {
          method: 'PATCH',
          headers: jsonHeaders,
          body: JSON.stringify(payload),
        });
        if (!patchRes.ok) throw new Error(`update failed: ${patchRes.status}`);
        const patchData = (await patchRes.json()) as { task: TaskWithLabels };

        const labelsRes = await fetch(`/tasks/${task.id}/labels`, {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify({ labelIds: Array.from(selectedLabels) }),
        });
        if (!labelsRes.ok) throw new Error(`labels update failed: ${labelsRes.status}`);
        const labelsData = (await labelsRes.json()) as { labels: Label[] };

        return { ...patchData.task, labels: labelsData.labels };
      },
      () => setBusyOp(null),
    );
    if (result.ok) {
      onUpdated(result.value);
      onClose();
    } else {
      setError(result.error instanceof Error ? result.error.message : '保存に失敗しました');
    }
  };

  const remove = async () => {
    if (busy) return;
    if (!confirm('タスクを削除しますか？')) return;
    setBusyOp('remove');
    const result = await tryAsync(
      () =>
        fetch(`/tasks/${task.id}`, {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken },
        }),
      () => setBusyOp(null),
    );
    if (result.ok) onDeleted(task);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" aria-labelledby="task-dialog-title">
        <DialogHeader>
          <DialogTitle id="task-dialog-title">タスク編集</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <UiLabel htmlFor="task-title">タイトル</UiLabel>
            <Input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <UiLabel htmlFor="task-description">説明</UiLabel>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <UiLabel htmlFor="task-priority">優先度</UiLabel>
            <PrioritySelect id="task-priority" value={priority} onChange={setPriority} />
          </div>
          <div className="space-y-1.5">
            <UiLabel htmlFor="task-due">期限</UiLabel>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">ラベル</legend>
            <div className="flex flex-wrap gap-2">
              {allLabels.map((l) => {
                const checked = selectedLabels.has(l.id);
                const id = `task-label-${l.id}`;
                return (
                  <label key={l.id} htmlFor={id} className="inline-flex items-center gap-1.5">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) => {
                        const next = new Set(selectedLabels);
                        if (value === true) next.add(l.id);
                        else next.delete(l.id);
                        setSelectedLabels(next);
                      }}
                    />
                    <LabelChip label={l} />
                  </label>
                );
              })}
            </div>
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="mt-2 flex-row justify-between sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={busy}
              loading={busyOp === 'remove'}
              loadingText="削除中…"
            >
              削除
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={busy || title.trim().length === 0}
                loading={busyOp === 'save'}
                loadingText="保存中…"
              >
                保存
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
