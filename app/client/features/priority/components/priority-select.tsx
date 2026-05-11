import { Badge } from '@client/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/components/ui/select';
import { cn } from '@client/lib/utils';
import type { Priority } from '@shared/priority';

const PRIORITY_OPTIONS: { value: Priority; label: string; badgeClass: string }[] = [
  { value: 'low', label: 'Low', badgeClass: 'bg-slate-400 text-white' },
  { value: 'medium', label: 'Medium', badgeClass: 'bg-sky-500 text-white' },
  { value: 'high', label: 'High', badgeClass: 'bg-red-500 text-white' },
];

export function PrioritySelect({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled,
}: {
  id?: string;
  value?: Priority;
  onChange: (v: Priority) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Priority)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full" aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const opt = PRIORITY_OPTIONS.find((o) => o.value === priority);
  return <Badge className={cn('border-transparent uppercase', opt?.badgeClass)}>{priority}</Badge>;
}
