import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class HomePage {
  private readonly heading: Locator;
  private readonly cta: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Task App', exact: true });
    this.cta = page.getByRole('link', { name: 'GitHub ではじめる' });
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.cta).toBeVisible();
  }
}
