import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

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
    await test.step('ログイン画面を開く', async () => {
      await this.page.goto('/auth/login');
    });
  }

  async expectLoaded() {
    await test.step('ログイン画面が表示されている', async () => {
      await expect(this.heading).toBeVisible();
      await expect(this.githubLoginLink).toBeVisible();
    });
  }
}
