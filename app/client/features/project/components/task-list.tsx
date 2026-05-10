import { Button } from '@client/components/ui/button';
import { Card } from '@client/components/ui/card';
import { Checkbox } from '@client/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/components/ui/dialog';
import { Input } from '@client/components/ui/input';
import { TaskDialog } from '@client/features/board/components/task-dialog';
import { LabelChip } from '@client/features/labels/components/label-chip';
import { LabelPicker } from '@client/features/labels/components/label-picker';
import { PrioritySelect } from '@client/features/priority/components/priority-select';
import { dueToInput, inputToDue } from '@client/lib/date';
import { cn } from '@client/lib/utils';
import type { Column } from '@shared/column';
import type { Label } from '@shared/label';
import type { Priority } from '@shared/priority';
import { Result } from '@shared/result';
import type { TaskWithLabels } from '@shared/task';
import { useState } from 'react';

interface Props {
  columns: Column[];
  tasks: TaskWithLabels[];
  labels: Label[];
  csrfToken: string;
}

export function TaskList({ columns, tasks: initialTasks, labels, csrfToken }: Props) {
  const [tasks, setTasks] = useState<TaskWithLabels[]>(initialTasks);
  const [openTask, setOpenTask] = useState<TaskWithLabels | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkLabelsOpen, setBulkLabelsOpen] = useState(false);

  const columnNameById = new Map(columns.map((c) => [c.id, c.name]));
  const allSelected = tasks.length > 0 && tasks.every((t) => selected.has(t.id));
  const someSelected = selected.size > 0;

  const jsonHeaders = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  };

  function applyBulk(updates: TaskWithLabels[]) {
    const map = new Map(updates.map((u) => [u.id, u]));
    setTasks((prev) => prev.map((t) => map.get(t.id) ?? t));
  }

  async function patchOne(id: string, patch: { priority?: Priority; dueDate?: number | null }) {
    const previous = tasks.find((t) => t.id === id);
    if (!previous) return;
    setError(null);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const result = await Result.try(
      fetch(`/tasks/${id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify(patch),
      }),
    );
    if (!result.ok || !result.value.ok) {
      setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
      setError('更新に失敗しました');
    }
  }

  async function bulkPatch(body: {
    patch?: { priority?: Priority; dueDate?: number | null };
    labelIds?: string[];
  }) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    const ids = Array.from(selected);
    const result = await Result.try(
      (async () => {
        const res = await fetch('/tasks/bulk', {
          method: 'PATCH',
          headers: jsonHeaders,
          body: JSON.stringify({ ids, ...body }),
        });
        if (!res.ok) throw new Error('一括更新に失敗しました');
        return (await res.json()) as { tasks: TaskWithLabels[] };
      })(),
    );
    setBulkBusy(false);
    if (result.ok) {
      applyBulk(result.value.tasks);
    } else {
      setError(result.error instanceof Error ? result.error.message : '一括更新に失敗しました');
    }
  }

  function toggleAll(value: boolean) {
    if (value) setSelected(new Set(tasks.map((t) => t.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: string, value: boolean) {
    const next = new Set(selected);
    if (value) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-3 p-6">
        {someSelected ? (
          <BulkToolbar
            count={selected.size}
            disabled={bulkBusy}
            onPriority={(p) => bulkPatch({ patch: { priority: p } })}
            onDueDate={(d) => bulkPatch({ patch: { dueDate: d } })}
            onLabels={() => setBulkLabelsOpen(true)}
            onClear={() => setSelected(new Set())}
          />
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">タスクがありません。</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="w-10 px-3 py-2">
                      <Checkbox
                        aria-label="全選択"
                        checked={allSelected}
                        onCheckedChange={(v) => toggleAll(v === true)}
                      />
                    </th>
                    <th className="px-3 py-2">ステータス</th>
                    <th className="px-3 py-2">タイトル</th>
                    <th className="w-40 px-3 py-2">優先度</th>
                    <th className="w-44 px-3 py-2">期限</th>
                    <th className="px-3 py-2">ラベル</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const isSel = selected.has(t.id);
                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          'border-b last:border-b-0',
                          isSel ? 'bg-accent/30' : 'hover:bg-accent/10',
                        )}
                      >
                        <td className="px-3 py-2 align-middle">
                          <Checkbox
                            aria-label={`${t.title} を選択`}
                            checked={isSel}
                            onCheckedChange={(v) => toggleOne(t.id, v === true)}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle text-muted-foreground">
                          {columnNameById.get(t.columnId) ?? '-'}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <button
                            type="button"
                            onClick={() => setOpenTask(t)}
                            className="block max-w-full truncate text-left font-medium hover:underline"
                            title={t.title}
                          >
                            {t.title}
                          </button>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <PrioritySelect
                            value={t.priority}
                            onChange={(p) => patchOne(t.id, { priority: p })}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <Input
                            aria-label={`${t.title} の期限`}
                            type="date"
                            value={dueToInput(t.dueDate)}
                            onChange={(e) =>
                              patchOne(t.id, { dueDate: inputToDue(e.target.value) })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {t.labels.length === 0 ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {t.labels.map((l) => (
                                <LabelChip key={l.id} label={l} />
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {openTask ? (
        <TaskDialog
          task={openTask}
          allLabels={labels}
          csrfToken={csrfToken}
          onClose={() => setOpenTask(null)}
          onUpdated={(t) => {
            setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)));
            setOpenTask(null);
          }}
          onDeleted={(t) => {
            setTasks((prev) => prev.filter((x) => x.id !== t.id));
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(t.id);
              return next;
            });
            setOpenTask(null);
          }}
        />
      ) : null}

      {bulkLabelsOpen ? (
        <BulkLabelsDialog
          allLabels={labels}
          busy={bulkBusy}
          count={selected.size}
          onClose={() => setBulkLabelsOpen(false)}
          onApply={async (labelIds) => {
            await bulkPatch({ labelIds });
            setBulkLabelsOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function BulkToolbar({
  count,
  disabled,
  onPriority,
  onDueDate,
  onLabels,
  onClear,
}: {
  count: number;
  disabled: boolean;
  onPriority: (p: Priority) => void;
  onDueDate: (d: number | null) => void;
  onLabels: () => void;
  onClear: () => void;
}) {
  const [priorityKey, setPriorityKey] = useState(0);
  const [date, setDate] = useState('');
  return (
    <Card className="sticky top-2 z-10 flex flex-wrap items-center gap-3 p-3">
      <span className="text-sm font-medium">{count} 件を一括更新</span>
      <div className="flex w-32 items-center gap-2">
        <span className="text-xs text-muted-foreground">優先度</span>
        <PrioritySelect
          key={priorityKey}
          ariaLabel="優先度を一括設定"
          placeholder="一括設定..."
          disabled={disabled}
          onChange={(p) => {
            setPriorityKey((k) => k + 1);
            onPriority(p);
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">期限</span>
        <Input
          type="date"
          aria-label="一括設定する期限"
          className="w-40"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={disabled}
        />
        <Button
          type="button"
          size="sm"
          disabled={disabled || !date}
          onClick={() => onDueDate(inputToDue(date))}
        >
          適用
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setDate('');
            onDueDate(null);
          }}
        >
          クリア
        </Button>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onLabels}>
        ラベルを一括設定…
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled}
        onClick={onClear}
        className="ml-auto"
      >
        選択解除
      </Button>
    </Card>
  );
}

function BulkLabelsDialog({
  allLabels,
  busy,
  count,
  onClose,
  onApply,
}: {
  allLabels: Label[];
  busy: boolean;
  count: number;
  onClose: () => void;
  onApply: (labelIds: string[]) => Promise<void> | void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md" aria-labelledby="bulk-labels-title">
        <DialogHeader>
          <DialogTitle id="bulk-labels-title">ラベルを一括設定</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          選択中 {count} 件のタスクのラベルを置き換えます。
        </p>
        <fieldset className="rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">ラベル</legend>
          {allLabels.length === 0 ? (
            <p className="text-sm text-muted-foreground">利用可能なラベルがありません。</p>
          ) : (
            <LabelPicker
              labels={allLabels}
              selected={picked}
              onChange={setPicked}
              idPrefix="bulk-label"
            />
          )}
        </fieldset>
        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => onApply(Array.from(picked))}
            loading={busy}
            loadingText="適用中…"
          >
            適用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
