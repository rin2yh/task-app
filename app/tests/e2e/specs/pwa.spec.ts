import { expect, test } from '../fixtures/session';

test('manifest が配信される', async ({ page }) => {
  const res = await page.goto('/manifest.webmanifest');
  expect(res?.status()).toBe(200);
  if (!res) throw new Error('expected response');
  const json = (await res.json()) as { name?: string };
  expect(json.name).toBeTruthy();
});

test('オフライン時にシェルが表示される（本番ビルド時のみ）', async ({
  page,
  context,
  authenticate,
}) => {
  test.skip(process.env.E2E_ENV !== 'prod', 'PWA 検証は本番ビルド向け');
  await authenticate('pwa');
  await page.goto('/');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/オフライン/)).toBeVisible();
});
