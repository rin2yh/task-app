import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { createDb } from '../db/client';
import type { AppEnv } from '../env';
import { Forbidden } from '../lib/errors';
import { CSRF_COOKIE, clearSessionCookies, findSession, SESSION_COOKIE } from './session';

export const sessionLoader: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  c.set('user', null);
  c.set('sessionToken', null);
  c.set('csrfToken', null);
  if (token) {
    const db = createDb(c.env.DB);
    const session = await findSession(db, token);
    if (session) {
      c.set('user', session.user);
      c.set('sessionToken', token);
      c.set('csrfToken', session.csrfToken);
    } else {
      clearSessionCookies(c);
    }
  }
  await next();
};

export const requireAuthentication: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    if (c.req.header('X-Inertia')) {
      // Inertia は 409 + X-Inertia-Location でリダイレクト
      c.header('X-Inertia-Location', '/auth/login');
      return c.body(null, 409);
    }
    return c.redirect('/auth/login', 302);
  }
  c.set('authUser', user);
  await next();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }
  const sessionCsrf = c.get('csrfToken');
  const cookieCsrf = getCookie(c, CSRF_COOKIE);
  const headerCsrf = c.req.header('X-CSRF-Token');
  if (!sessionCsrf || !cookieCsrf || !headerCsrf) {
    throw Forbidden('Missing CSRF token');
  }
  if (sessionCsrf !== cookieCsrf || cookieCsrf !== headerCsrf) {
    throw Forbidden('CSRF token mismatch');
  }
  await next();
};
