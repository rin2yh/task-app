import type { Context } from 'hono';
import type { AppEnv } from '../../env';
import type { GitHubUser, OAuthClient } from './client';

export class FakeGitHubOAuthClient implements OAuthClient {
  constructor(private readonly c: Context<AppEnv>) {}
  createAuthorizationURL(state: string, _scopes: string[]): URL {
    const login = this.c.req.query('login') ?? 'e2e-user';
    // 認可画面を介さず /auth/callback に直接バウンスさせる。code に login を
    // 載せ、後段の fetchUser が同じ文字列から user を組み立てる。
    const url = new URL(`${this.c.env.APP_URL}/auth/callback`);
    url.searchParams.set('code', login);
    url.searchParams.set('state', state);
    return url;
  }
  async validateAuthorizationCode(code: string): Promise<string> {
    return code;
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
