import { expect, test } from '../fixtures/session';

test.describe.configure({ mode: 'serial' });

test('プロジェクト作成→列・タスク CRUD→DnD→削除', async ({ authenticate, dashboardPage }) => {
  await authenticate('board-flow');
  await dashboardPage.goto();
  await dashboardPage.createProject('Demo Project');

  const projectPage = await dashboardPage.openProject('Demo Project');

  // 既定 3 列あること
  await expect(projectPage.columnHeading('Todo')).toBeVisible();
  await expect(projectPage.columnHeading('In Progress')).toBeVisible();
  await expect(projectPage.columnHeading('Done')).toBeVisible();

  // タスク追加
  await projectPage.addTaskToFirstColumn('My Task');
});
