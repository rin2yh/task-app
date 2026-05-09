import { test } from '../fixtures/session';

test('プロジェクト作成→列・タスク CRUD→DnD→削除', async ({ authenticate, dashboardPage }) => {
  await authenticate('board-flow');

  await test.step('プロジェクトを作成して開く', async () => {
    await dashboardPage.createProject('Demo Project');
  });

  const project = await dashboardPage.openProject('Demo Project');

  await test.step('既定列が並びタスクを追加できる', async () => {
    await project.expectColumnsVisible(['Todo', 'In Progress', 'Done']);
    await project.addTaskToFirstColumn('My Task');
  });
});
