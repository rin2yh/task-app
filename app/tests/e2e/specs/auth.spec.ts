import { expect, test } from '../fixtures/session';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';

test('未ログイン時は /auth/login にリダイレクト', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.url()).toContain('/auth/login');
  await new LoginPage(page).expectLoaded();
});

test('fake gh OAuth フローでログインしダッシュボードにアクセスできる', async ({
  page,
  authenticate,
}) => {
  const dashboard = new DashboardPage(page);
  await authenticate('e2e-user');
  await dashboard.goto();
  await expect(dashboard.header).toContainText('e2e-user');
  await expect(dashboard.logoutButton).toBeVisible();
});

test('ログアウトでセッション削除', async ({ page, authenticate }) => {
  const dashboard = new DashboardPage(page);
  await authenticate('logout-flow');
  await dashboard.goto();
  await dashboard.logout();
  await expect(page).toHaveURL(/\/auth\/login/);
});
