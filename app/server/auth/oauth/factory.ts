import type { Context } from 'hono';
import type { AppEnv } from '../../env';
import type { OAuthClient } from './client';
import { FakeGitHubOAuthClient } from './fake-github-client';
import { GitHubOAuthClient } from './github-client';

export interface CreateOAuthOptions {
  login?: string;
}

export function createOAuthClient(
  c: Context<AppEnv>,
  options: CreateOAuthOptions = {},
): OAuthClient {
  if (process.env.NODE_ENV === 'test') return new FakeGitHubOAuthClient(c, options.login);
  return new GitHubOAuthClient(c.env);
}
