import type { Context } from 'hono';
import type { AppEnv } from '../../env';
import type { OAuthClient } from './client';
import { FakeGitHubOAuthClient } from './fake-github-client';
import { GitHubOAuthClient } from './github-client';

export function createOAuthClient(c: Context<AppEnv>): OAuthClient {
  if (process.env.NODE_ENV === 'test') return new FakeGitHubOAuthClient(c);
  return new GitHubOAuthClient(c.env);
}
