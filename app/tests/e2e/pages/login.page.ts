import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class LoginPage {
  private readonly page: Page;
  private readonly heading: Locator;
  private readonly githubLoginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Task App にログイン' });
    this.githubLoginLink = page.getByRole('link', { name: 'GitHub でログイン' });
  }

  async goto() {
    await this.page.goto('/auth/login');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.githubLoginLink).toBeVisible();
  }
}
