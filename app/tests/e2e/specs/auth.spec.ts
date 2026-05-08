import { expect, test } from '../fixtures/session';

test('未ログイン時は /auth/login にリダイレクト', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.url()).toContain('/auth/login');
});

test('fake gh OAuth フローでログインしダッシュボードにアクセスできる', async ({
  page,
  authenticate,
}) => {
  await authenticate('e2e-user');
  await page.goto('/');
  await expect(page.getByRole('banner')).toContainText('e2e-user');
  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible();
});

test('ログアウトでセッション削除', async ({ page, authenticate }) => {
  await authenticate('logout-flow');
  await page.goto('/');
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
});
