import type { CookieOptions } from 'express';

export function securityConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 || /troque|change.?me|example/i.test(secret)) throw new Error('JWT_SECRET must contain at least 32 unpredictable bytes.');
  const origins = (process.env.FRONTEND_URL ?? '').split(',').map(x => x.trim()).filter(Boolean);
  if (!origins.length || origins.some(x => { try { const u = new URL(x); return u.origin !== x || !['http:', 'https:'].includes(u.protocol); } catch { return true; } })) throw new Error('FRONTEND_URL must contain explicit HTTP(S) origins.');
  const production = process.env.NODE_ENV === 'production';
  for (const name of ['GENERAL', 'ADMIN', 'LOGIN', 'LOGOUT', 'ORDER_CREATE', 'PAYMENT']) {
    const value = process.env[`RATE_LIMIT_${name}`];
    if (value !== undefined && (!Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 10000)) throw new Error(`RATE_LIMIT_${name} must be an integer between 1 and 10000.`);
  }
  if (production && (process.env.HTTPS_ENABLED !== 'true' || origins.some(x => !x.startsWith('https://')))) throw new Error('Production requires HTTPS_ENABLED=true and HTTPS origins.');
  return { secret, origins, production };
}
export const SESSION_COOKIE = 'salgados_session';
export const CSRF_COOKIE = 'salgados_csrf';
export const SESSION_SECONDS = 900;
export function cookieOptions(): CookieOptions {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api', maxAge: SESSION_SECONDS * 1000 };
}
export function readCookie(raw: string | undefined, name: string): string | undefined {
  const values = (raw ?? '').split(';').map(x => x.trim()).filter(x => x.startsWith(`${name}=`));
  if (values.length !== 1) return undefined;
  try { return decodeURIComponent(values[0].slice(name.length + 1)); } catch { return undefined; }
}
