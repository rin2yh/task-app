import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class ProjectPage {
  private readonly page: Page;
  private readonly heading: Locator;

  constructor(page: Page, projectName: string) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: projectName });
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async addTaskToFirstColumn(title: string) {
    await this.page
      .getByRole('button', { name: /タスク追加/ })
      .first()
      .click();
    const dialog = this.newTaskDialog();
    await dialog.getByPlaceholder('タイトル').fill(title);
    await dialog.getByRole('button', { name: '作成' }).click();
    await expect(this.taskCard(title)).toBeVisible();
  }

  async expectColumnsVisible(names: string[]) {
    for (const name of names) {
      await expect(this.columnHeading(name)).toBeVisible();
    }
  }

  async openListView() {
    await this.page
      .getByRole('navigation', { name: 'ビュー切替' })
      .getByRole('link', { name: 'リスト' })
      .click();
    await expect(
      this.page
        .getByRole('navigation', { name: 'ビュー切替' })
        .getByRole('link', { name: 'リスト' }),
    ).toHaveAttribute('aria-current', 'page');
  }

  async expectTaskInListView(columnName: string, taskTitle: string) {
    const region = this.page.getByRole('region', {
      name: new RegExp(`^${columnName}\\b`),
    });
    await expect(region.getByRole('button', { name: `タスク: ${taskTitle}` })).toBeVisible();
  }

  private columnHeading(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }

  private taskCard(title: string): Locator {
    return this.page.getByText(title, { exact: true });
  }

  private newTaskDialog(): Locator {
    return this.page.getByRole('dialog', { name: '新規タスク' });
  }
}
