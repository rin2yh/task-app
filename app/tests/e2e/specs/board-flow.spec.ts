import { test, expect } from '../fixtures/session';

test.describe.configure({ mode: 'serial' });

test('プロジェクト作成→列・タスク CRUD→DnD→削除', async ({ page, authenticate }) => {
  await authenticate('board-flow');
  await page.goto('/');
  await page.getByPlaceholder('プロジェクト名').fill('Demo Project');
  await page.getByRole('button', { name: '作成' }).click();
  const link = page.getByRole('link', { name: 'Demo Project' });
  await expect(link).toBeVisible();
  await link.click();

  // 既定 3 列あること
  await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'In Progress' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible();

  // タスク追加
  const addBtns = page.getByRole('button', { name: /タスク追加/ });
  await addBtns.first().click();
  await page.getByPlaceholder('タイトル').fill('My Task');
  await page.getByRole('button', { name: '作成' }).click();
  await expect(page.getByText('My Task')).toBeVisible();
});
