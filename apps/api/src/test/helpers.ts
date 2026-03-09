/**
 * Shared test helpers for API integration tests.
 *
 * Every helper uses Fastify's `app.inject()` so no HTTP server is started.
 */

import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../app.js';

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

/**
 * Build a fully-configured Fastify app suitable for testing.
 *
 * The app is built via the same `buildApp()` used in production, so all
 * plugins, routes, and middleware are registered identically.
 *
 * Callers should `await app.close()` in `afterAll` to release DB connections.
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  // Wait for all plugins to finish loading
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: 'publisher' | 'advertiser';
  companyName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

/**
 * Register a new user via POST /api/v1/auth/register.
 * Returns the raw Fastify inject response.
 */
export async function registerUser(
  app: FastifyInstance,
  payload: RegisterPayload,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload,
  });
}

/**
 * Log in a user via POST /api/v1/auth/login.
 * Returns the raw Fastify inject response (inspect `headers['set-cookie']`).
 */
export async function loginUser(
  app: FastifyInstance,
  payload: LoginPayload,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload,
  });
}

/**
 * Extract the `adstack_session` cookie from a Set-Cookie header value so it
 * can be forwarded in subsequent requests.
 */
export function extractSessionCookie(res: LightMyRequestResponse): string {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) {
    throw new Error('No set-cookie header found in response');
  }

  // set-cookie may be a string or string[]
  const raw = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;

  // Extract just the cookie key=value pair (before the first ";")
  const match = raw.match(/adstack_session=[^;]+/);
  if (!match) {
    throw new Error('adstack_session cookie not found');
  }
  return match[0];
}

/**
 * Convenience: register + login in one shot and return the cookie string.
 */
export async function registerAndLogin(
  app: FastifyInstance,
  payload: RegisterPayload,
): Promise<string> {
  await registerUser(app, payload);
  const loginRes = await loginUser(app, {
    email: payload.email,
    password: payload.password,
  });
  return extractSessionCookie(loginRes);
}

// ---------------------------------------------------------------------------
// Authenticated request helper
// ---------------------------------------------------------------------------

/**
 * Make an authenticated request using a previously-obtained session cookie.
 */
export async function authenticatedRequest(
  app: FastifyInstance,
  method: InjectOptions['method'],
  url: string,
  cookie: string,
  body?: unknown,
): Promise<LightMyRequestResponse> {
  const opts: InjectOptions = {
    method,
    url,
    headers: {
      cookie,
    },
  };

  if (body !== undefined && body !== null) {
    opts.payload = body as Record<string, unknown>;
  }

  return app.inject(opts);
}

// ---------------------------------------------------------------------------
// Unique value generators (avoid collisions between test runs)
// ---------------------------------------------------------------------------

let counter = 0;

/** Generate a unique email for a test user. */
export function uniqueEmail(prefix = 'test'): string {
  counter += 1;
  return `${prefix}+${Date.now()}-${counter}@test.adstack.io`;
}
