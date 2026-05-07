import { test as base } from '@playwright/test';

export const test = base.extend<{
  authenticate: (login: string) => Promise<void>;
}>({
  authenticate: async ({ context }, use) => {
    const fn = async (login: string) => {
      // context.request shares the cookie jar with the browser context, so
      // Set-Cookie from this POST is attached to subsequent page navigation.
      const res = await context.request.post('/auth/test-login', { data: { login } });
      if (!res.ok()) throw new Error(`test-login failed: ${res.status()}`);
    };
    await use(fn);
  },
});

export const expect = test.expect;
