import type { Context } from 'hono';
import type { AppEnv, Env } from '../env';
import type { GitHubUser, OAuthClient } from './oauth';

// `/auth/github?login=xxx` で渡された login を access token として一連の OAuth
// フローを完走させ、本物と同じ /auth/callback ハンドラに到達させる。
export class FakeGitHubOAuthClient implements OAuthClient {
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
