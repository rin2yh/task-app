import { eq, lt } from 'drizzle-orm';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import type { Database } from '../db/client';
import { type DbUser, sessions, users } from '../db/schema';
import type { AppEnv } from '../env';

export const SESSION_COOKIE = 'session';
export const CSRF_COOKIE = 'csrf';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// http://localhost で動作する dev/E2E でも cookie が届くように、HTTPS リクエストのみ secure を立てる
const isSecure = (c: Context<AppEnv>): boolean => new URL(c.req.url).protocol === 'https:';

export function setSessionCookies(
  c: Context<AppEnv>,
  session: { token: string; csrfToken: string },
): void {
  const secure = isSecure(c);
  setCookie(c, SESSION_COOKIE, session.token, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    maxAge: SESSION_TTL_MS / 1000,
  });
  setCookie(c, CSRF_COOKIE, session.csrfToken, {
    path: '/',
    httpOnly: false,
    secure,
    sameSite: 'Lax',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookies(c: Context<AppEnv>): void {
  const secure = isSecure(c);
  setCookie(c, SESSION_COOKIE, '', {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    maxAge: 0,
  });
  setCookie(c, CSRF_COOKIE, '', {
    path: '/',
    httpOnly: false,
    secure,
    sameSite: 'Lax',
    maxAge: 0,
  });
}

export function setOAuthStateCookie(c: Context<AppEnv>, name: string, value: string): void {
  setCookie(c, name, value, {
    path: '/',
    httpOnly: true,
    secure: isSecure(c),
    sameSite: 'Lax',
    maxAge: 600,
  });
}

export function clearOAuthStateCookie(c: Context<AppEnv>, name: string): void {
  setCookie(c, name, '', {
    path: '/',
    httpOnly: true,
    secure: isSecure(c),
    sameSite: 'Lax',
    maxAge: 0,
  });
}

export function generateToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type CreatedSession = {
  token: string;
  csrfToken: string;
  expiresAt: number;
};

export async function createSession(db: Database, userId: number): Promise<CreatedSession> {
  const token = generateToken();
  const csrfToken = generateToken(16);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await db.insert(sessions).values({
    token,
    userId,
    csrfToken,
    expiresAt,
    createdAt: now,
  });
  return { token, csrfToken, expiresAt };
}

export async function findSession(
  db: Database,
  token: string,
): Promise<{ user: DbUser; csrfToken: string; expiresAt: number } | null> {
  const rows = await db
    .select({
      user: users,
      csrfToken: sessions.csrfToken,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }
  return row;
}

export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function purgeExpired(db: Database): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));
}
