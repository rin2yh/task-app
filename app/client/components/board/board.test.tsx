import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Column, Label, TaskWithLabels } from '../../../shared/types';
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
    render(<Board projectId="p" columns={cols} tasks={tasks} labels={labels} csrfToken="x" />);
    expect(screen.getByTestId('column-c1')).toBeInTheDocument();
    expect(screen.getByTestId('column-c2')).toBeInTheDocument();
    expect(screen.getByTestId('task-t1')).toBeInTheDocument();
  });
});
