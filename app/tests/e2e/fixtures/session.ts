import { test as base } from '@playwright/test';

interface Fixtures {
  authenticate: (login: string) => Promise<void>;
}

export const test = base.extend<Fixtures>({
  authenticate: async ({ page }, use) => {
    const fn = async (login: string) => {
      await page.goto(`/auth/github?login=${encodeURIComponent(login)}`);
      await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
    };
    await use(fn);
  },
});

export const expect = test.expect;
