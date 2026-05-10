import { cn } from '@client/lib/utils';

export type ProjectView = 'board' | 'list';

const buttonBase = 'rounded-md px-3 py-1.5';
const pressedClass = 'bg-primary text-primary-foreground';
const unpressedClass =
  'border border-input bg-background hover:bg-accent hover:text-accent-foreground';

export function ViewSwitcher({
  value,
  onChange,
}: {
  value: ProjectView;
  onChange: (v: ProjectView) => void;
}) {
  return (
    <div className="flex gap-2 text-sm">
      <Toggle pressed={value === 'board'} onClick={() => onChange('board')}>
        ボード
      </Toggle>
      <Toggle pressed={value === 'list'} onClick={() => onChange('list')}>
        リスト
      </Toggle>
    </div>
  );
}

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(buttonBase, pressed ? pressedClass : unpressedClass)}
    >
      {children}
    </button>
  );
}
