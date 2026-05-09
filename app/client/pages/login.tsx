import { Button } from '@client/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/components/ui/card';
import { useEffect } from 'react';

interface Props {
  error: string | null;
  turnstileSiteKey: string;
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

function errorMessage(error: string): string {
  if (error === 'turnstile') return 'ボット対策の検証に失敗しました。もう一度お試しください。';
  if (error === 'state') return 'セッションが無効になりました。もう一度お試しください。';
  if (error === 'oauth') return 'GitHub 認証に失敗しました。';
  return error;
}

export default function Login({ error, turnstileSiteKey }: Props) {
  useEffect(() => {
    if (!turnstileSiteKey) return;
    if (document.getElementById(TURNSTILE_SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [turnstileSiteKey]);

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
              エラー: {errorMessage(error)}
            </p>
          ) : null}
          <form method="post" action="/auth/github" className="space-y-4">
            {turnstileSiteKey ? (
              <div className="flex justify-center">
                <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
              </div>
            ) : null}
            <Button type="submit" className="w-full">
              GitHub でログイン
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
