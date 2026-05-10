import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['client/**/*.test.{ts,tsx}'],
    setupFiles: ['./client/test-setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['client/**/*.{ts,tsx}'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@server': path.resolve(dir, 'server'),
      '@client': path.resolve(dir, 'client'),
      '@shared': path.resolve(dir, 'shared'),
    },
  },
});
