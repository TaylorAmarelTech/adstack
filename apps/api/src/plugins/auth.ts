import { createHmac } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Simple JWT helpers using Node.js built-in crypto (HMAC-SHA256)
// ---------------------------------------------------------------------------

const ALGORITHM = 'HS256';
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const COOKIE_NAME = 'adstack_session';

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  // Restore padding
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const mod = padded.length % 4;
  if (mod === 2) padded += '==';
  else if (mod === 3) padded += '=';
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: ALGORITHM, typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signature}`;
}

interface JwtPayload {
  id: string;
  email: string;
  role: 'publisher' | 'advertiser' | 'admin';
  iat: number;
  exp: number;
}

function verify(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, providedSignature] = parts;

  // Verify the signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (providedSignature !== expectedSignature) return null;

  // Decode and parse payload
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload!)) as JwtPayload;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function getCookieOptions(clear = false) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    domain: env.COOKIE_DOMAIN,
    ...(clear ? { maxAge: 0 } : { maxAge: TOKEN_EXPIRY_SECONDS }),
  };
}

// ---------------------------------------------------------------------------
// Exported helpers for use by routes
// ---------------------------------------------------------------------------

/** Sign a JWT for the given user payload and set it as a cookie on the reply. */
export function setAuthCookie(
  reply: FastifyReply,
  user: { id: string; email: string; role: 'publisher' | 'advertiser' | 'admin' },
): void {
  const token = sign(
    { id: user.id, email: user.email, role: user.role },
    env.SESSION_SECRET,
  );
  reply.setCookie(COOKIE_NAME, token, getCookieOptions());
}

/** Clear the auth cookie. */
export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, getCookieOptions(true));
}

// ---------------------------------------------------------------------------
// Fastify plugin
// ---------------------------------------------------------------------------

async function authPluginFn(app: FastifyInstance) {
  // Register @fastify/cookie if not already registered
  // (cookie plugin should already be registered, but guard against it)
  if (!app.hasDecorator('parseCookie')) {
    const cookie = await import('@fastify/cookie');
    await app.register(cookie.default, { secret: env.SESSION_SECRET });
  }

  // Decorate request with a `user` property (initialised to null)
  app.decorateRequest('user', null);

  // ------------------------------------------------------------------
  // authenticate — rejects unauthenticated requests with 401
  // ------------------------------------------------------------------
  async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = request.cookies?.[COOKIE_NAME];

    if (!token) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const payload = verify(token, env.SESSION_SECRET);

    if (!payload) {
      clearAuthCookie(reply);
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' },
      });
      return;
    }

    request.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: '', // Filled from DB when needed; JWT keeps it lean
    };
  }

  // ------------------------------------------------------------------
  // optionalAuth — tries to authenticate but does NOT reject
  // ------------------------------------------------------------------
  async function optionalAuth(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const token = request.cookies?.[COOKIE_NAME];
    if (!token) return;

    const payload = verify(token, env.SESSION_SECRET);
    if (!payload) return;

    request.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: '',
    };
  }

  app.decorate('authenticate', authenticate);
  app.decorate('optionalAuth', optionalAuth);
}

export const authPlugin = fp(authPluginFn, {
  name: 'auth',
  dependencies: ['db'],
});
