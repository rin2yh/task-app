export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
}

export interface AppVariables {
  user: import('./db/schema').DbUser | null;
  authUser: import('./db/schema').DbUser;
  sessionToken: string | null;
  csrfToken: string | null;
}

export interface AppEnv {
  Bindings: Env;
  Variables: AppVariables;
}
