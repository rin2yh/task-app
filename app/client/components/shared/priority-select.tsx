import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
    <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="low">Low</SelectItem>
        <SelectItem value="medium">Medium</SelectItem>
        <SelectItem value="high">High</SelectItem>
      </SelectContent>
    </Select>
  );
}

const PRIORITY_CLASSES: Record<Priority, string> = {
  low: 'bg-slate-400 text-white hover:bg-slate-400/90',
  medium: 'bg-sky-500 text-white hover:bg-sky-500/90',
  high: 'bg-red-500 text-white hover:bg-red-500/90',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      data-testid="priority"
      className={cn('uppercase border-transparent', PRIORITY_CLASSES[priority])}
    >
      {priority}
    </Badge>
  );
}
