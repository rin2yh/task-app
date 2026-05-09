import type { Context } from 'hono';
import type { SharedProps } from '../../shared/types';
import type { AppEnv } from '../env';

export function buildSharedProps(c: Context<AppEnv>): SharedProps {
  const user = c.get('user');
  const csrfToken = c.get('csrfToken') ?? '';
  return {
    auth: {
      user: user
        ? {
            id: user.id,
            login: user.login,
            name: user.name,
            avatarUrl: user.avatarUrl,
          }
        : null,
    },
    csrfToken,
    flash: {},
  };
}
