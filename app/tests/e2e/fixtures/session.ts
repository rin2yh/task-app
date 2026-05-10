import { test as base } from '@playwright/test';

interface Fixtures {
  authenticate: (login: string) => Promise<void>;
}

export const test = base.extend<Fixtures>({
  authenticate: async ({ page }, use) => {
    const fn = async (login: string) => {
      // NODE_ENV=test では FakeGitHubOAuthClient が /auth/callback に直接
      // バウンスし、Turnstile verifier も常に成功する。
      const res = await page.request.post('/auth/github', { form: { login } });
      if (!res.ok()) throw new Error(`fake oauth failed: ${res.status()}`);
      await page.goto(new URL(res.url()).pathname);
    };
    await use(fn);
  },
});

export const expect = test.expect;
