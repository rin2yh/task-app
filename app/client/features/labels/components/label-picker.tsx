import { Checkbox } from '@client/components/ui/checkbox';
import type { Label } from '@shared/label';
import { LabelChip } from './label-chip';

interface Props {
  labels: Label[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  idPrefix: string;
}

export function LabelPicker({ labels, selected, onChange, idPrefix }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((l) => {
        const checked = selected.has(l.id);
        const id = `${idPrefix}-${l.id}`;
        return (
          <label key={l.id} htmlFor={id} className="inline-flex items-center gap-1.5">
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(value) => {
                const next = new Set(selected);
                if (value === true) next.add(l.id);
                else next.delete(l.id);
                onChange(next);
              }}
            />
            <LabelChip label={l} />
          </label>
        );
      })}
    </div>
  );
}
