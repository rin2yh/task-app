import { buttonVariants } from '@client/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/components/ui/card';
import { cn } from '@client/lib/utils';
import { usePage } from '@inertiajs/react';
import type { SharedProps } from '@shared/inertia';

export default function Home() {
  const { props: shared } = usePage<SharedProps>();
  const isAuthed = shared.auth.user !== null;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Task App</CardTitle>
          <CardDescription>
            プロジェクトとタスクをカンバンで管理するシンプルなツールです。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href={isAuthed ? '/dashboard' : '/auth/github'}
            className={cn(buttonVariants(), 'w-full')}
          >
            {isAuthed ? 'ダッシュボードへ' : 'GitHub ではじめる'}
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
