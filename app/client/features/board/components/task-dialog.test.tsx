import type { TaskWithLabels } from '@shared/task';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskDialog } from './task-dialog';

const task: TaskWithLabels = {
  id: 't1',
  projectColumnId: 'c1',
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
  it('disables save button when title is blank', async () => {
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
    expect(save).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(save);
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
