import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
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
    await this.page.goto('/');
  }

  private projectLink(name: string): Locator {
    return this.page.getByRole('link', { name });
  }

  async createProject(name: string) {
    await this.projectNameInput.fill(name);
    await this.createButton.click();
    await expect(this.projectLink(name)).toBeVisible();
  }

  async openProject(name: string): Promise<ProjectPage> {
    await this.projectLink(name).click();
    const project = new ProjectPage(this.page, name);
    await project.expectLoaded();
    return project;
  }

  async logout() {
    await this.logoutButton.click();
  }

  async expectLoggedInAs(login: string) {
    await expect(this.header).toContainText(login);
    await expect(this.logoutButton).toBeVisible();
  }
}
