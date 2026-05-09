import { test as base } from '@playwright/test';

interface Fixtures {
  authenticate: (login: string) => Promise<void>;
}

export const test = base.extend<Fixtures>({
  authenticate: async ({ page }, use) => {
    const fn = async (login: string) => {
      // NODE_ENV=test でビルドされた worker は FakeGitHubOAuthClient を使い、
      // /auth/github → /auth/callback まで一気に redirect される。
      // 本番フローは Turnstile 付きの POST だが、verifier は NODE_ENV=test で
      // 常に成功するためダミートークンで十分。
      const res = await page.request.post('/auth/github', {
        form: { login, 'cf-turnstile-response': 'test' },
      });
      if (!res.ok()) throw new Error(`fake oauth failed: ${res.status()}`);
      await page.goto(new URL(res.url()).pathname);
    };
    await use(fn);
  },
});

export const expect = test.expect;
