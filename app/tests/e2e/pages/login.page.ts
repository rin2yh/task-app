import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class LoginPage {
  private readonly heading: Locator;
  private readonly githubLoginLink: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Task App にログイン' });
    this.githubLoginLink = page.getByRole('link', { name: 'GitHub でログイン' });
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.githubLoginLink).toBeVisible();
  }
}
