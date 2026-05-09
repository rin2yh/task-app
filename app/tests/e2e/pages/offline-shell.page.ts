import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

export class OfflineShellPage {
  private readonly offlineMessage: Locator;

  constructor(page: Page) {
    this.offlineMessage = page.getByText(/オフライン/);
  }

  async expectVisible() {
    await test.step('オフラインシェルが表示されている', async () => {
      await expect(this.offlineMessage).toBeVisible();
    });
  }
}
