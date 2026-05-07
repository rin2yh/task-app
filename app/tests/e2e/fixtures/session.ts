import { test as base, type APIRequestContext, type BrowserContext } from '@playwright/test';

export const test = base.extend<{
  authenticate: (login: string) => Promise<void>;
}>({
  authenticate: async ({ context, request }, use) => {
    const fn = async (login: string) => {
      const res = await request.post('/auth/test-login', { data: { login } });
      if (!res.ok()) throw new Error(`test-login failed: ${res.status()}`);
      const cookies = res.headers()['set-cookie'];
      if (cookies) {
        await context.addCookies(parseSetCookies(cookies, 'localhost'));
      }
    };
    await use(fn);
  },
});

export const expect = test.expect;

function parseSetCookies(header: string, domain: string) {
  return header
    .split(/, (?=[^,]+=)/)
    .map((part) => {
      const [kv] = part.split(';');
      const [name, ...rest] = kv!.split('=');
      return { name: name!.trim(), value: rest.join('='), domain, path: '/' };
    });
}
