import type { TaskWithLabels } from '@shared/task';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskDialog } from './task-dialog';

const task: TaskWithLabels = {
  id: 't1',
  columnId: 'c1',
  title: 'hello',
  description: 'world',
  priority: 'medium',
  dueDate: null,
  position: 1,
  createdAt: 0,
  updatedAt: 0,
  labels: [],
};

describe('TaskDialog', () => {
  it('shows validation error when title is blank', async () => {
    const onClose = vi.fn();
    const onUpdated = vi.fn();
    const onDeleted = vi.fn();
    render(
      <TaskDialog
        task={task}
        allLabels={[]}
        csrfToken="x"
        onClose={onClose}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />,
    );
    const input = screen.getByLabelText(/タイトル/);
    fireEvent.change(input, { target: { value: '' } });
    const save = screen.getByRole('button', { name: /保存/ });
    fireEvent.click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent(/必須/);
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
