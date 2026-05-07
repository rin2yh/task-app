import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// 各テストで Inertia の usePage をデフォルト stub。個別 test で再 mock 可。
vi.mock('@inertiajs/react', async () => {
  const actual = await vi.importActual<typeof import('@inertiajs/react')>('@inertiajs/react');
  return {
    ...actual,
    usePage: () => ({
      props: {
        auth: { user: { id: 1, login: 'tester', name: 'Tester', avatarUrl: null } },
        csrfToken: 'csrf-token-test',
        flash: {},
      },
      url: '/',
      component: 'dashboard',
      version: '1',
    }),
    router: {
      reload: vi.fn(),
      visit: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});
