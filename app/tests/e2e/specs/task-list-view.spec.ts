import { test } from '../fixtures/session';
import { DashboardPage } from '../pages/dashboard.page';

test('リストビューで列ごとにタスクが表示される', async ({ page, authenticate }) => {
  await authenticate('task-list-view');
  const dashboard = new DashboardPage(page);

  await dashboard.createProject('List View Project');
  const project = await dashboard.openProject('List View Project');

  await project.addTaskToFirstColumn('List View Task');
  await project.openListView();
  await project.expectTaskInListView('Todo', 'List View Task');
});
