import { GitHub, OAuth2RequestError } from 'arctic';
import type { Env } from '../env';

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

export function createGitHubProvider(env: Env): GitHub {
  return new GitHub(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, `${env.APP_URL}/auth/callback`);
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'task-app',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub user: ${res.status}`);
  }
  return (await res.json()) as GitHubUser;
}

export { OAuth2RequestError };
