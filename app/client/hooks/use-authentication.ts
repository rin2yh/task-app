import { usePage } from '@inertiajs/react';
import type { SharedProps } from '@shared/inertia';
import type { User } from '@shared/user';

export function useAuthentication(): { user: User | null; isAuthenticated: boolean } {
  const { props } = usePage<SharedProps>();
  return {
    user: props.authentication.user,
    isAuthenticated: props.authentication.user !== null,
  };
}
