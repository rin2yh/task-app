import { test as base } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';

interface Fixtures {
  authenticate: (login: string) => Promise<void>;
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
}

export const test = base.extend<Fixtures>({
  authenticate: async ({ page }, use) => {
    const fn = async (login: string) => {
      // E2E_AUTH=1 で起動された worker は FakeGitHubOAuthClient を使い、
      // /auth/github → /auth/callback まで一気に redirect される。
      await page.goto(`/auth/github?login=${encodeURIComponent(login)}`);
      await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
    };
    await use(fn);
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export const expect = test.expect;
