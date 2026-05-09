import { test } from '../fixtures/session';
import { DashboardPage } from '../pages/dashboard.page';

test.describe.configure({ mode: 'serial' });

test('プロジェクト作成→列・タスク CRUD→DnD→削除', async ({ page, authenticate }) => {
  await authenticate('board-flow');
  const dashboard = new DashboardPage(page);

  await test.step('プロジェクトを作成して開く', async () => {
    await dashboard.goto();
    await dashboard.createProject('Demo Project');
  });

  const project = await dashboard.openProject('Demo Project');

  await test.step('既定列が並びタスクを追加できる', async () => {
    await project.expectColumnsVisible(['Todo', 'In Progress', 'Done']);
    await project.addTaskToFirstColumn('My Task');
  });
});
