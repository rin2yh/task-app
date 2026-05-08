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
    <dialog open aria-labelledby="task-dialog-title">
      <form
        onSubmit={save}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 320 }}
      >
        <h3 id="task-dialog-title" style={{ margin: 0 }}>
          タスク編集
        </h3>
        <label>
          タイトル
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </label>
        <label>
          説明
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </label>
        <label htmlFor="task-priority">優先度</label>
        <PrioritySelect id="task-priority" value={priority} onChange={setPriority} />
        <label>
          期限
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <fieldset
          style={{ border: '1px solid var(--c-border)', borderRadius: '0.4rem', padding: '0.4rem' }}
        >
          <legend>ラベル</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {allLabels.map((l) => {
              const checked = selectedLabels.has(l.id);
              return (
                <label
                  key={l.id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selectedLabels);
                      if (e.target.checked) next.add(l.id);
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
          <p role="alert" style={{ color: '#b91c1c' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
          <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
            削除
          </button>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              保存
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
