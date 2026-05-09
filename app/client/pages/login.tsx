import { buttonVariants } from '@client/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/components/ui/card';
import { cn } from '@client/lib/utils';

type Props = { error: string | null };

export default function Login({ error }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Task App にログイン</CardTitle>
          <CardDescription>GitHub アカウントでサインインしてください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              エラー: {error}
            </p>
          ) : null}
          <a href="/auth/github" className={cn(buttonVariants(), 'w-full')}>
            GitHub でログイン
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
