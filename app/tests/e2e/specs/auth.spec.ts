import { expect, test } from '../fixtures/session';

test('未ログイン時は /auth/login にリダイレクト', async ({ page, loginPage }) => {
  const res = await page.goto('/');
  expect(res?.url()).toContain('/auth/login');
  await loginPage.expectLoaded();
});

test('fake gh OAuth フローでログインしダッシュボードにアクセスできる', async ({
  authenticate,
  dashboardPage,
}) => {
  await authenticate('e2e-user');
  await dashboardPage.goto();
  await expect(dashboardPage.header).toContainText('e2e-user');
  await expect(dashboardPage.logoutButton).toBeVisible();
});

test('ログアウトでセッション削除', async ({ page, authenticate, dashboardPage }) => {
  await authenticate('logout-flow');
  await dashboardPage.goto();
  await dashboardPage.logout();
  await expect(page).toHaveURL(/\/auth\/login/);
});
