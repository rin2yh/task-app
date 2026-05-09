import type { User } from './user';

export interface SharedProps {
  // Inertia の usePage<T extends PageProps>() 制約を満たすため必要。type alias と違い interface は暗黙の index signature を持たない。
  [key: string]: unknown;
  auth: { user: User | null };
  csrfToken: string;
  flash: { success?: string; error?: string };
}
