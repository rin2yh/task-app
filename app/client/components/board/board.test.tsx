import type { Column } from '@shared/column';
import type { Label } from '@shared/label';
import type { TaskWithLabels } from '@shared/task';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Board } from './board';

const cols: Column[] = [
  { id: 'c1', projectId: 'p', name: 'Todo', position: 1, createdAt: 0 },
  { id: 'c2', projectId: 'p', name: 'Done', position: 2, createdAt: 0 },
];

const tasks: TaskWithLabels[] = [
  {
    id: 't1',
    columnId: 'c1',
    title: 'first',
    description: null,
    priority: 'medium',
    dueDate: null,
    position: 1,
    createdAt: 0,
    updatedAt: 0,
    labels: [],
  },
];

const labels: Label[] = [];

describe('Board', () => {
  it('renders columns and tasks', () => {
    render(<Board columns={cols} tasks={tasks} labels={labels} csrfToken="x" />);
    expect(screen.getByRole('heading', { name: 'Todo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /first/ })).toBeInTheDocument();
  });
});
