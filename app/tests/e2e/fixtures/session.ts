import { test as base } from '@playwright/test';

export const test = base.extend<{
  authenticate: (login: string) => Promise<void>;
}>({
  authenticate: async ({ page }, use) => {
    const fn = async (login: string) => {
      // 本物の /auth/github → fake authorize → /auth/callback フローを通す。
      // E2E_AUTH=1 で起動された worker のみ /auth/__fake-gh/authorize が機能する。
      await page.goto(`/auth/github?login=${encodeURIComponent(login)}`);
      await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
    };
    await use(fn);
  },
});

export const expect = test.expect;
