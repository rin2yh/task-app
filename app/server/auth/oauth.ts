export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

export interface OAuthClient {
  createAuthorizationURL(state: string, scopes: string[]): URL;
  validateAuthorizationCode(code: string): Promise<{ accessToken: string }>;
  fetchUser(accessToken: string): Promise<GitHubUser>;
}
