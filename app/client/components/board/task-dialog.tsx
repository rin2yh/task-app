import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label as UiLabel } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import type { Label, Priority, TaskWithLabels } from '../../../shared/types';
import { LabelChip } from '../shared/label-chip';
import { PrioritySelect } from '../shared/priority-select';

type Props = {
  task: TaskWithLabels;
  allLabels: Label[];
  csrfToken: string;
  onClose: () => void;
  onUpdated: (task: TaskWithLabels) => void;
  onDeleted: (task: TaskWithLabels) => void;
};

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
  const [busy, setBusy] = useState(false);
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('タイトル必須');
      return;
    }
    setError(null);
    setBusy(true);
    try {
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

      onUpdated({ ...patchData.task, labels: labelsData.labels });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('タスクを削除しますか？')) return;
    setBusy(true);
    try {
      await fetch(`/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      onDeleted(task);
    } finally {
      setBusy(false);
    }
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
            <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
              削除
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                キャンセル
              </Button>
              <Button type="submit" disabled={busy}>
                保存
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
