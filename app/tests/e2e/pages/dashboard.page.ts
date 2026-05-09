import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { ProjectPage } from './project.page';

export class DashboardPage {
  private readonly page: Page;
  private readonly header: Locator;
  private readonly projectNameInput: Locator;
  private readonly createButton: Locator;
  private readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.getByRole('banner');
    this.projectNameInput = page.getByPlaceholder('プロジェクト名');
    this.createButton = page.getByRole('button', { name: '作成' });
    this.logoutButton = page.getByRole('button', { name: 'ログアウト' });
  }

  async goto() {
    await test.step('ダッシュボードを開く', async () => {
      await this.page.goto('/');
    });
  }

  private projectLink(name: string): Locator {
    return this.page.getByRole('link', { name });
  }

  async createProject(name: string) {
    await test.step(`プロジェクト "${name}" を作成`, async () => {
      await this.projectNameInput.fill(name);
      await this.createButton.click();
      await expect(this.projectLink(name)).toBeVisible();
    });
  }

  async openProject(name: string): Promise<ProjectPage> {
    return await test.step(`プロジェクト "${name}" を開く`, async () => {
      await this.projectLink(name).click();
      const project = new ProjectPage(this.page, name);
      await project.expectLoaded();
      return project;
    });
  }

  async logout() {
    await test.step('ログアウト', async () => {
      await this.logoutButton.click();
    });
  }

  async expectLoggedInAs(login: string) {
    await test.step(`ユーザー "${login}" でログイン中である`, async () => {
      await expect(this.header).toContainText(login);
      await expect(this.logoutButton).toBeVisible();
    });
  }
}
