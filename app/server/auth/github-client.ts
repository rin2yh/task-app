import { GitHub } from 'arctic';
import type { Env } from '../env';
import type { GitHubUser, OAuthClient } from './oauth';

export class GitHubOAuthClient implements OAuthClient {
  private readonly gh: GitHub;
  constructor(env: Env) {
    this.gh = new GitHub(
      env.GITHUB_CLIENT_ID,
      env.GITHUB_CLIENT_SECRET,
      `${env.APP_URL}/auth/callback`,
    );
  }
  createAuthorizationURL(state: string, scopes: string[]): URL {
    return this.gh.createAuthorizationURL(state, scopes);
  }
  async validateAuthorizationCode(code: string) {
    const tokens = await this.gh.validateAuthorizationCode(code);
    return { accessToken: tokens.accessToken() };
  }
  async fetchUser(accessToken: string): Promise<GitHubUser> {
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
}
