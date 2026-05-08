import { test as base } from '@playwright/test';

export const test = base.extend<{
  authenticate: (login: string) => Promise<void>;
}>({
  authenticate: async ({ page }, use) => {
    const fn = async (login: string) => {
      // E2E_AUTH=1 で起動された worker は FakeGitHubOAuthClient を使い、
      // /auth/github → /auth/callback まで一気に redirect される。
      await page.goto(`/auth/github?login=${encodeURIComponent(login)}`);
      await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
    };
    await use(fn);
  },
});

export const expect = test.expect;
