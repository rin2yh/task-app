import { cn } from '@client/lib/utils';

type ProjectView = 'board' | 'list';

const linkBase = 'rounded-md px-3 py-1.5';
const activeClass = 'bg-primary text-primary-foreground';
const inactiveClass =
  'border border-input bg-background hover:bg-accent hover:text-accent-foreground';

export function ViewSwitcher({ projectId, current }: { projectId: string; current: ProjectView }) {
  return (
    <nav aria-label="ビュー切替" className="flex gap-2 text-sm">
      <Tab href={`/projects/${projectId}`} active={current === 'board'}>
        ボード
      </Tab>
      <Tab href={`/projects/${projectId}/tasks`} active={current === 'list'}>
        リスト
      </Tab>
    </nav>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(linkBase, active ? activeClass : inactiveClass)}
    >
      {children}
    </a>
  );
}
