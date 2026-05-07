import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/client/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/unit/client/setup.ts'],
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
      '@server': '/server',
      '@client': '/client',
      '@shared': '/shared',
    },
  },
});
