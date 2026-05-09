import { buttonVariants } from '@client/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/components/ui/card';
import { useAuthentication } from '@client/hooks/use-authentication';
import { cn } from '@client/lib/utils';

export default function Home() {
  const { isAuthenticated } = useAuthentication();

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
            href={isAuthenticated ? '/dashboard' : '/auth/login'}
            className={cn(buttonVariants(), 'w-full')}
          >
            {isAuthenticated ? 'ダッシュボードへ' : 'GitHub ではじめる'}
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
