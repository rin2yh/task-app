import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class LoginPage {
  private readonly title: Locator;
  private readonly githubLoginLink: Locator;

  constructor(page: Page) {
    this.title = page.getByText('Task App にログイン');
    this.githubLoginLink = page.getByRole('link', { name: 'GitHub でログイン' });
  }

  async expectLoaded() {
    await expect(this.title).toBeVisible();
    await expect(this.githubLoginLink).toBeVisible();
  }
}
