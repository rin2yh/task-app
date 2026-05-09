import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

export class ProjectPage {
  private readonly page: Page;
  private readonly heading: Locator;
  private readonly newColumnInput: Locator;
  private readonly addColumnButton: Locator;

  constructor(page: Page, projectName: string) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: projectName });
    this.newColumnInput = page.getByPlaceholder('新しい列名');
    this.addColumnButton = page.getByRole('button', { name: '列追加' });
  }

  async expectLoaded() {
    await test.step('プロジェクト画面が表示されている', async () => {
      await expect(this.heading).toBeVisible();
    });
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

  async addColumn(name: string) {
    await test.step(`列 "${name}" を追加`, async () => {
      await this.newColumnInput.fill(name);
      await this.addColumnButton.click();
      await expect(this.columnHeading(name)).toBeVisible();
    });
  }

  async addTaskToFirstColumn(title: string) {
    await test.step(`最初の列にタスク "${title}" を追加`, async () => {
      await this.page
        .getByRole('button', { name: /タスク追加/ })
        .first()
        .click();
      const dialog = this.newTaskDialog();
      await dialog.getByPlaceholder('タイトル').fill(title);
      await dialog.getByRole('button', { name: '作成' }).click();
      await expect(this.taskCard(title)).toBeVisible();
    });
  }

  async expectColumnsVisible(names: string[]) {
    await test.step(`列 [${names.join(', ')}] が表示されている`, async () => {
      for (const name of names) {
        await expect(this.columnHeading(name)).toBeVisible();
      }
    });
  }
}
