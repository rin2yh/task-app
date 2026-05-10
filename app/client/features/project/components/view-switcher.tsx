import { cn } from '@client/lib/utils';

export type ProjectView = 'board' | 'list';

const tabBase = 'rounded-md px-3 py-1.5';
const activeClass = 'bg-primary text-primary-foreground';
const inactiveClass =
  'border border-input bg-background hover:bg-accent hover:text-accent-foreground';

export function ViewSwitcher({
  value,
  onChange,
}: {
  value: ProjectView;
  onChange: (v: ProjectView) => void;
}) {
  return (
    <div role="tablist" aria-label="ビュー切替" className="flex gap-2 text-sm">
      <Tab active={value === 'board'} onClick={() => onChange('board')}>
        ボード
      </Tab>
      <Tab active={value === 'list'} onClick={() => onChange('list')}>
        リスト
      </Tab>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(tabBase, active ? activeClass : inactiveClass)}
    >
      {children}
    </button>
  );
}
