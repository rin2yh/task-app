import type { Context } from 'hono';
import type { AppEnv } from '../env';
import type { SharedProps } from '../../shared/types';

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
