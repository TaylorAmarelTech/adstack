import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  buildTestApp,
  registerUser,
  loginUser,
  extractSessionCookie,
  authenticatedRequest,
  uniqueEmail,
} from '../test/helpers.js';
import { publishers, advertisers } from '../db/schema/index.js';

describe('Auth routes', () => {
  let app: FastifyInstance;

  // Track emails created in this suite so we can clean them up
  const createdEmails: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    // Clean up test records
    for (const email of createdEmails) {
      await app.db.delete(publishers).where(eq(publishers.email, email));
      await app.db.delete(advertisers).where(eq(advertisers.email, email));
    }
    await app.close();
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/auth/register
  // -----------------------------------------------------------------------
  describe('POST /api/v1/auth/register', () => {
    it('registers a publisher successfully', async () => {
      const email = uniqueEmail('pub');
      createdEmails.push(email);

      const res = await registerUser(app, {
        email,
        password: 'securePass123!',
        name: 'Test Publisher',
        role: 'publisher',
      });

      expect(res.statusCode).toBe(201);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(email);
      expect(body.data.name).toBe('Test Publisher');
      expect(body.data.role).toBe('publisher');
      expect(body.data.id).toBeDefined();
    });

    it('registers an advertiser successfully', async () => {
      const email = uniqueEmail('adv');
      createdEmails.push(email);

      const res = await registerUser(app, {
        email,
        password: 'securePass123!',
        name: 'Test Advertiser',
        role: 'advertiser',
        companyName: 'Acme Corp',
      });

      expect(res.statusCode).toBe(201);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(email);
      expect(body.data.role).toBe('advertiser');
    });

    it('returns 409 for duplicate email', async () => {
      const email = uniqueEmail('dup');
      createdEmails.push(email);

      // First registration should succeed
      await registerUser(app, {
        email,
        password: 'securePass123!',
        name: 'First User',
        role: 'publisher',
      });

      // Second registration with same email should fail
      const res = await registerUser(app, {
        email,
        password: 'anotherPass123!',
        name: 'Second User',
        role: 'publisher',
      });

      expect(res.statusCode).toBe(409);

      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('EMAIL_EXISTS');
    });

    it('returns 400 for invalid email', async () => {
      const res = await registerUser(app, {
        email: 'not-an-email',
        password: 'securePass123!',
        name: 'Bad Email User',
        role: 'publisher',
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for short password', async () => {
      const res = await registerUser(app, {
        email: uniqueEmail('short'),
        password: 'abc',
        name: 'Short Pass User',
        role: 'publisher',
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/auth/login
  // -----------------------------------------------------------------------
  describe('POST /api/v1/auth/login', () => {
    const loginEmail = uniqueEmail('login');

    beforeAll(async () => {
      createdEmails.push(loginEmail);
      await registerUser(app, {
        email: loginEmail,
        password: 'loginPass123!',
        name: 'Login Test User',
        role: 'publisher',
      });
    });

    it('logs in successfully and sets cookie', async () => {
      const res = await loginUser(app, {
        email: loginEmail,
        password: 'loginPass123!',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe(loginEmail);

      // Should have a set-cookie header with adstack_session
      const cookie = extractSessionCookie(res);
      expect(cookie).toContain('adstack_session=');
    });

    it('returns 401 for wrong password', async () => {
      const res = await loginUser(app, {
        email: loginEmail,
        password: 'wrongPassword123!',
      });

      expect(res.statusCode).toBe(401);

      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 for nonexistent email', async () => {
      const res = await loginUser(app, {
        email: 'nobody@nowhere.test',
        password: 'doesNotMatter1!',
      });

      expect(res.statusCode).toBe(401);

      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/auth/me
  // -----------------------------------------------------------------------
  describe('GET /api/v1/auth/me', () => {
    let cookie: string;
    const meEmail = uniqueEmail('me');

    beforeAll(async () => {
      createdEmails.push(meEmail);

      await registerUser(app, {
        email: meEmail,
        password: 'mePass123!',
        name: 'Me Test User',
        role: 'publisher',
      });

      const loginRes = await loginUser(app, {
        email: meEmail,
        password: 'mePass123!',
      });

      cookie = extractSessionCookie(loginRes);
    });

    it('returns the authenticated user', async () => {
      const res = await authenticatedRequest(app, 'GET', '/api/v1/auth/me', cookie);

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe(meEmail);
      expect(body.data.user.role).toBe('publisher');
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(res.statusCode).toBe(401);

      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/auth/logout
  // -----------------------------------------------------------------------
  describe('POST /api/v1/auth/logout', () => {
    it('clears the session cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Logged out');

      // The set-cookie header should clear the cookie (maxAge=0 or Expires in the past)
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();

      const raw = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie!;
      // Cookie is cleared via Max-Age=0 or an expired Expires value
      const isClearingCookie =
        raw.includes('Max-Age=0') ||
        raw.includes('max-age=0') ||
        raw.includes('Expires=Thu, 01 Jan 1970');
      expect(isClearingCookie).toBe(true);
    });
  });
});
