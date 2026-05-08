import type { Priority } from '../../../shared/types';

export function PrioritySelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: Priority;
  onChange: (v: Priority) => void;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as Priority)}>
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
    </select>
  );
}

const COLORS: Record<Priority, string> = {
  low: '#94a3b8',
  medium: '#0ea5e9',
  high: '#ef4444',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      data-testid="priority"
      style={{
        fontSize: '0.7rem',
        padding: '2px 6px',
        borderRadius: 4,
        background: COLORS[priority],
        color: 'white',
        textTransform: 'uppercase',
      }}
    >
      {priority}
    </span>
  );
}
