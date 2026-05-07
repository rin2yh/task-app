import { test, expect } from '../fixtures/session';

test('未ログイン時は /auth/login にリダイレクト', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.url()).toContain('/auth/login');
});

test('test-login バックドアでログインしダッシュボードにアクセスできる', async ({
  page,
  authenticate,
}) => {
  await authenticate('e2e-user');
  await page.goto('/');
  await expect(page.getByTestId('auth-login')).toContainText('e2e-user');
});

test('ログアウトでセッション削除', async ({ page, authenticate }) => {
  await authenticate('logout-flow');
  await page.goto('/');
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
});
