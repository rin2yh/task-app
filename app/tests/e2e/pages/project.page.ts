import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class ProjectPage {
  readonly page: Page;
  readonly projectName: string;
  readonly heading: Locator;
  readonly backLink: Locator;
  readonly newColumnInput: Locator;
  readonly addColumnButton: Locator;

  constructor(page: Page, projectName: string) {
    this.page = page;
    this.projectName = projectName;
    this.heading = page.getByRole('heading', { name: projectName });
    this.backLink = page.getByRole('link', { name: '← 戻る' });
    this.newColumnInput = page.getByPlaceholder('新しい列名');
    this.addColumnButton = page.getByRole('button', { name: '列追加' });
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  columnHeading(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }

  taskCard(title: string): Locator {
    return this.page.getByText(title, { exact: true });
  }

  newTaskDialog(): Locator {
    return this.page.getByRole('dialog', { name: '新規タスク' });
  }

  taskEditDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'タスク編集' });
  }

  async addColumn(name: string) {
    await this.newColumnInput.fill(name);
    await this.addColumnButton.click();
    await expect(this.columnHeading(name)).toBeVisible();
  }

  /** 最初の列に対してタスク追加ダイアログを開き、タイトル入力 → 作成。 */
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
}
