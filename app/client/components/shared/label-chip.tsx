import { Badge } from '@/components/ui/badge';
import type { Label } from '../../../shared/types';

export function LabelChip({ label }: { label: Label }) {
  return (
    <Badge
      variant="outline"
      className="border-transparent rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
      style={{ background: label.color, color: pickFg(label.color) }}
    >
      {label.name}
    </Badge>
  );
}

function pickFg(hex: string): string {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return '#000';
  const v = m[1]!;
  const r = Number.parseInt(v.slice(0, 2), 16);
  const g = Number.parseInt(v.slice(2, 4), 16);
  const b = Number.parseInt(v.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0f172a' : '#fff';
}
