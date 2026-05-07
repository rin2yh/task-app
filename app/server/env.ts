export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: 'development' | 'production' | 'test';
  APP_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ALLOWED_LOGINS?: string;
  E2E_AUTH?: string;
};

export type AppVariables = {
  user: import('./db/schema').DbUser | null;
  sessionToken: string | null;
  csrfToken: string | null;
};

export type AppEnv = { Bindings: Env; Variables: AppVariables };
