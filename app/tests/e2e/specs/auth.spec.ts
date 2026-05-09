import { test } from '../fixtures/session';
import { DashboardPage } from '../pages/dashboard.page';
import { HomePage } from '../pages/home.page';
import { LoginPage } from '../pages/login.page';

test('未ログイン時は / で公開トップページが表示される', async ({ page }) => {
  await page.goto('/');
  await new HomePage(page).expectLoaded();
});

test('fake gh OAuth フローでログインしダッシュボードにアクセスできる', async ({
  page,
  authenticate,
}) => {
  await authenticate('e2e-user');
  await new DashboardPage(page).expectLoggedInAs('e2e-user');
});

test('ログアウトでセッション削除', async ({ page, authenticate }) => {
  await authenticate('logout-flow');
  await new DashboardPage(page).logout();
  await new LoginPage(page).expectLoaded();
});
