import { GitHub, OAuth2RequestError } from 'arctic';
import type { Context } from 'hono';
import type { AppEnv, Env } from '../env';

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

export interface OAuthClient {
  createAuthorizationURL(state: string, scopes: string[]): URL;
  validateAuthorizationCode(code: string): Promise<{ accessToken: () => string }>;
  fetchUser(accessToken: string): Promise<GitHubUser>;
}

class GitHubOAuthClient implements OAuthClient {
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
  validateAuthorizationCode(code: string) {
    return this.gh.validateAuthorizationCode(code);
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

// E2E 用のフェイク。`/auth/github?login=xxx` で渡された login を access token として
// 一連のフローを通し、本物と同じ /auth/callback ハンドラに到達させる。
class FakeGitHubOAuthClient implements OAuthClient {
  constructor(
    private readonly env: Env,
    private readonly c: Context<AppEnv>,
  ) {}
  createAuthorizationURL(state: string, _scopes: string[]): URL {
    const login = this.c.req.query('login') ?? 'e2e-user';
    const url = new URL(`${this.env.APP_URL}/auth/__fake-gh/authorize`);
    url.searchParams.set('state', state);
    url.searchParams.set('login', login);
    url.searchParams.set('redirect_uri', `${this.env.APP_URL}/auth/callback`);
    return url;
  }
  async validateAuthorizationCode(code: string) {
    return { accessToken: () => code };
  }
  async fetchUser(accessToken: string): Promise<GitHubUser> {
    const login = accessToken;
    return { id: stableIdFromLogin(login), login, name: login, avatar_url: null };
  }
}

function stableIdFromLogin(login: string): number {
  let h = 0;
  for (let i = 0; i < login.length; i++) {
    h = (h * 31 + login.charCodeAt(i)) & 0x7fffffff;
  }
  return h || 1;
}

export function createOAuthClient(c: Context<AppEnv>): OAuthClient {
  if (c.env.E2E_AUTH === '1') return new FakeGitHubOAuthClient(c.env, c);
  return new GitHubOAuthClient(c.env);
}

export { OAuth2RequestError };
