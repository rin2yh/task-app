import { test as base } from '@playwright/test';

interface Fixtures {
  authenticate: (login: string) => Promise<void>;
}

export const test = base.extend<Fixtures>({
  authenticate: async ({ page }, use) => {
    const fn = async (login: string) => {
      // NODE_ENV=test でビルドされた worker は FakeGitHubOAuthClient を使い、
      // /auth/github → /auth/callback まで一気に redirect される。
      await page.goto(`/auth/github?login=${encodeURIComponent(login)}`);
      await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
    };
    await use(fn);
  },
});

export const expect = test.expect;
