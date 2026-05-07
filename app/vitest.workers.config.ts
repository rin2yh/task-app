import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.resolve(__dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: '2025-12-01',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: ['DB'],
          bindings: {
            ENVIRONMENT: 'test',
            APP_URL: 'http://localhost:5173',
            GITHUB_CLIENT_ID: 'test-client-id',
            GITHUB_CLIENT_SECRET: 'test-client-secret',
            SESSION_SECRET: 'test-session-secret-32-chars-padding',
            E2E_AUTH: '1',
            ALLOWED_LOGINS: '',
            TEST_MIGRATIONS: migrations,
          },
        },
        wrangler: { configPath: './wrangler.toml' },
      }),
    ],
    test: {
      include: ['server/**/*.test.ts'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        include: ['server/**/*.ts'],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
      },
    },
  };
});
