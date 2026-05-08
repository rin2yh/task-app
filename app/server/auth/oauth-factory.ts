import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { FakeGitHubOAuthClient } from './fake-github-client';
import { GitHubOAuthClient } from './github-client';
import type { OAuthClient } from './oauth';

export function createOAuthClient(c: Context<AppEnv>): OAuthClient {
  if (c.env.E2E_AUTH === '1') return new FakeGitHubOAuthClient(c.env, c);
  return new GitHubOAuthClient(c.env);
}
