import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { ProjectPage } from './project.page';

export class DashboardPage {
  readonly page: Page;
  readonly header: Locator;
  readonly heading: Locator;
  readonly projectNameInput: Locator;
  readonly createButton: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.getByRole('banner');
    this.heading = page.getByRole('heading', { name: 'プロジェクト' });
    this.projectNameInput = page.getByPlaceholder('プロジェクト名');
    this.createButton = page.getByRole('button', { name: '作成' });
    this.logoutButton = page.getByRole('button', { name: 'ログアウト' });
  }

  async goto() {
    await this.page.goto('/');
  }

  projectLink(name: string): Locator {
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
    await this.page.waitForURL(/\/auth\/login/);
  }
}
