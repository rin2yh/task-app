import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, createTestUser } from '../_test-helpers';

describe('Inertia protocol smoke', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('returns JSON for X-Inertia: true requests', async () => {
    const u = await createTestUser('inertia');
    const res = await SELF.fetch('http://localhost/', {
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
