import { beforeEach, describe, expect } from 'vitest';
import { applyMigrations, createTestUser, it } from '../../tests/helpers';

describe('Inertia protocol smoke', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('returns JSON for X-Inertia: true requests', async ({ fetch }) => {
    const u = await createTestUser('inertia');
    const res = await fetch('/dashboard', {
      headers: {
        cookie: u.cookies,
        'X-Inertia': 'true',
        'X-Inertia-Version': '1',
        Accept: 'application/json',
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = (await res.json()) as {
      component: string;
      props: Record<string, unknown>;
    };
    expect(body.component).toBe('dashboard');
    expect(body.props).toBeTypeOf('object');
  });
});
