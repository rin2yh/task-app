import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class OfflineShellPage {
  private readonly offlineMessage: Locator;

  constructor(page: Page) {
    this.offlineMessage = page.getByText(/オフライン/);
  }

  async expectLoaded() {
    await expect(this.offlineMessage).toBeVisible();
  }
}
