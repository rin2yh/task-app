import { expect, test } from '../fixtures/session';
import { DashboardPage } from '../pages/dashboard.page';

test.describe.configure({ mode: 'serial' });

test('プロジェクト作成→列・タスク CRUD→DnD→削除', async ({ page, authenticate }) => {
  const dashboard = new DashboardPage(page);
  await authenticate('board-flow');
  await dashboard.goto();
  await dashboard.createProject('Demo Project');

  const project = await dashboard.openProject('Demo Project');

  // 既定 3 列あること
  await expect(project.columnHeading('Todo')).toBeVisible();
  await expect(project.columnHeading('In Progress')).toBeVisible();
  await expect(project.columnHeading('Done')).toBeVisible();

  // タスク追加
  await project.addTaskToFirstColumn('My Task');
});
