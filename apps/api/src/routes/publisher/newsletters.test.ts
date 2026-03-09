import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  buildTestApp,
  registerAndLogin,
  authenticatedRequest,
  uniqueEmail,
} from '../../test/helpers.js';
import { publishers, newsletters } from '../../db/schema/index.js';

describe('Publisher newsletter routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  const testEmail = uniqueEmail('nl-pub');

  // IDs created by tests so we can clean up
  const createdNewsletterIds: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();

    cookie = await registerAndLogin(app, {
      email: testEmail,
      password: 'newsletter123!',
      name: 'Newsletter Test Publisher',
      role: 'publisher',
    });
  });

  afterAll(async () => {
    // Clean up newsletters created during tests
    for (const id of createdNewsletterIds) {
      await app.db.delete(newsletters).where(eq(newsletters.id, id)).catch(() => {});
    }
    // Clean up the test publisher
    await app.db.delete(publishers).where(eq(publishers.email, testEmail)).catch(() => {});
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const validNewsletter = {
    name: 'My Tech Newsletter',
    description: 'Weekly deep dives into technology',
    websiteUrl: 'https://tech-newsletter.example.com',
    primaryCategory: 'technology',
    subcategories: ['ai', 'startups'],
    espProvider: 'beehiiv' as const,
    espApiKey: 'test-key-12345',
  };

  async function createNewsletter(overrides: Record<string, unknown> = {}) {
    const res = await authenticatedRequest(
      app,
      'POST',
      '/api/v1/publisher/newsletters',
      cookie,
      { ...validNewsletter, ...overrides },
    );
    const body = res.json();
    if (body.success && body.data?.id) {
      createdNewsletterIds.push(body.data.id);
    }
    return res;
  }

  // -----------------------------------------------------------------------
  // Authentication guard
  // -----------------------------------------------------------------------
  describe('authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/publisher/newsletters',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/publisher/newsletters
  // -----------------------------------------------------------------------
  describe('GET /api/v1/publisher/newsletters', () => {
    it('returns an empty list initially', async () => {
      const res = await authenticatedRequest(
        app,
        'GET',
        '/api/v1/publisher/newsletters',
        cookie,
      );

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/publisher/newsletters
  // -----------------------------------------------------------------------
  describe('POST /api/v1/publisher/newsletters', () => {
    it('creates a newsletter', async () => {
      const res = await createNewsletter();

      expect(res.statusCode).toBe(201);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(validNewsletter.name);
      expect(body.data.primaryCategory).toBe(validNewsletter.primaryCategory);
      expect(body.data.id).toBeDefined();
      expect(body.data.publisherId).toBeDefined();
      expect(body.data.status).toBe('pending_verification');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/publisher/newsletters/:id
  // -----------------------------------------------------------------------
  describe('GET /api/v1/publisher/newsletters/:id', () => {
    it('returns a created newsletter', async () => {
      const createRes = await createNewsletter({ name: 'Get By ID Newsletter' });
      const created = createRes.json().data;

      const res = await authenticatedRequest(
        app,
        'GET',
        `/api/v1/publisher/newsletters/${created.id}`,
        cookie,
      );

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(created.id);
      expect(body.data.name).toBe('Get By ID Newsletter');
    });

    it('returns 404 for non-existent newsletter', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000000';
      const res = await authenticatedRequest(
        app,
        'GET',
        `/api/v1/publisher/newsletters/${fakeId}`,
        cookie,
      );

      expect(res.statusCode).toBe(404);

      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // -----------------------------------------------------------------------
  // PATCH /api/v1/publisher/newsletters/:id
  // -----------------------------------------------------------------------
  describe('PATCH /api/v1/publisher/newsletters/:id', () => {
    it('updates a newsletter', async () => {
      const createRes = await createNewsletter({ name: 'Before Update' });
      const created = createRes.json().data;

      const res = await authenticatedRequest(
        app,
        'PATCH',
        `/api/v1/publisher/newsletters/${created.id}`,
        cookie,
        { name: 'After Update' },
      );

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('After Update');
      expect(body.data.id).toBe(created.id);
    });

    it('returns 404 when updating a non-existent newsletter', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000000';
      const res = await authenticatedRequest(
        app,
        'PATCH',
        `/api/v1/publisher/newsletters/${fakeId}`,
        cookie,
        { name: 'Should Fail' },
      );

      expect(res.statusCode).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // DELETE /api/v1/publisher/newsletters/:id
  // -----------------------------------------------------------------------
  describe('DELETE /api/v1/publisher/newsletters/:id', () => {
    it('deletes a newsletter', async () => {
      const createRes = await createNewsletter({ name: 'To Be Deleted' });
      const created = createRes.json().data;

      const deleteRes = await authenticatedRequest(
        app,
        'DELETE',
        `/api/v1/publisher/newsletters/${created.id}`,
        cookie,
      );

      expect(deleteRes.statusCode).toBe(200);

      const body = deleteRes.json();
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Newsletter deleted');

      // Verify it's actually gone
      const getRes = await authenticatedRequest(
        app,
        'GET',
        `/api/v1/publisher/newsletters/${created.id}`,
        cookie,
      );

      expect(getRes.statusCode).toBe(404);

      // Remove from cleanup list since it's already deleted
      const idx = createdNewsletterIds.indexOf(created.id);
      if (idx !== -1) createdNewsletterIds.splice(idx, 1);
    });

    it('returns 404 when deleting a non-existent newsletter', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000000';
      const res = await authenticatedRequest(
        app,
        'DELETE',
        `/api/v1/publisher/newsletters/${fakeId}`,
        cookie,
      );

      expect(res.statusCode).toBe(404);
    });
  });
});
