import { test } from '../fixtures/session';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';

test('未ログイン時は /auth/login にリダイレクト', async ({ page }) => {
  await page.goto('/');
  await new LoginPage(page).expectLoaded();
});

test('fake gh OAuth フローでログインしダッシュボードにアクセスできる', async ({
  page,
  authenticate,
}) => {
  await authenticate('e2e-user');
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.expectLoggedInAs('e2e-user');
});

test('ログアウトでセッション削除', async ({ page, authenticate }) => {
  await authenticate('logout-flow');
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.logout();
  await new LoginPage(page).expectLoaded();
});
