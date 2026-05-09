import { test as base } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';
import { OfflineShellPage } from '../pages/offline-shell.page';

interface Fixtures {
  authenticate: (login: string) => Promise<void>;
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  offlineShellPage: OfflineShellPage;
}

export const test = base.extend<Fixtures>({
  authenticate: async ({ page }, use) => {
    // NODE_ENV=test でビルドされた worker は FakeGitHubOAuthClient を使い、
    // /auth/github → /auth/callback まで一気に redirect される。
    await use(async (login: string) => {
      await page.goto(`/auth/github?login=${encodeURIComponent(login)}`);
      await page.waitForURL((url) => !url.pathname.startsWith('/auth/'));
    });
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  offlineShellPage: async ({ page }, use) => {
    await use(new OfflineShellPage(page));
  },
});

export const expect = test.expect;
