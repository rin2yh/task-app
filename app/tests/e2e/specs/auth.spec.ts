import { test } from '../fixtures/session';

test('未ログイン時は /auth/login にリダイレクト', async ({ page, loginPage }) => {
  await page.goto('/');
  await loginPage.expectLoaded();
});

test('fake gh OAuth フローでログインしダッシュボードにアクセスできる', async ({
  authenticate,
  dashboardPage,
}) => {
  await authenticate('e2e-user');
  await dashboardPage.expectLoggedInAs('e2e-user');
});

test('ログアウトでセッション削除', async ({ authenticate, dashboardPage, loginPage }) => {
  await authenticate('logout-flow');
  await dashboardPage.logout();
  await loginPage.expectLoaded();
});
