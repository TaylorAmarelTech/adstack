import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { commonSchemas, newsletterSchemas } from '@adstack/shared';
import { eq, and, sql } from 'drizzle-orm';
import { newsletters } from '../../db/schema/index.js';

/** Helper to format a newsletter row into the standard API response shape */
function formatNewsletter(n: typeof newsletters.$inferSelect) {
  return {
    id: n.id,
    publisherId: n.publisherId,
    name: n.name,
    description: n.description,
    websiteUrl: n.websiteUrl,
    primaryCategory: n.primaryCategory,
    subcategories: n.subcategories ?? [],
    espProvider: n.espProvider,
    metrics: {
      subscriberCount: n.subscriberCount,
      activeSubscribers: n.activeSubscribers,
      avgOpenRate: n.avgOpenRate,
      avgClickRate: n.avgClickRate,
    },
    status: n.status,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function newsletterRoutes(app: FastifyInstance) {
  // List newsletters for the current publisher
  app.get(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Newsletter'],
        summary: 'List newsletters',
        querystring: commonSchemas.paginationQuery,
      },
    },
    async (request) => {
      const userId = request.user!.id;
      const { page, limit } = request.query as { page: number; limit: number };
      const offset = (page - 1) * limit;

      const results = await app.db.query.newsletters.findMany({
        where: eq(newsletters.publisherId, userId),
        limit,
        offset,
      });

      const [countRow] = await app.db
        .select({ count: sql<number>`count(*)::int` })
        .from(newsletters)
        .where(eq(newsletters.publisherId, userId));

      const total = countRow?.count ?? 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true as const,
        data: results.map(formatNewsletter),
        pagination: { page, limit, total, totalPages },
      };
    },
  );

  // Get a single newsletter
  app.get(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Newsletter'],
        summary: 'Get newsletter details',
        params: z.object({ id: commonSchemas.id }),
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { id } = request.params as { id: string };

      const newsletter = await app.db.query.newsletters.findFirst({
        where: and(eq(newsletters.id, id), eq(newsletters.publisherId, userId)),
      });

      if (!newsletter) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Newsletter not found' },
        });
      }

      return {
        success: true as const,
        data: formatNewsletter(newsletter),
      };
    },
  );

  // Create a newsletter
  app.post(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Newsletter'],
        summary: 'Create a newsletter',
        body: newsletterSchemas.createNewsletter,
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const body = request.body as {
        name: string;
        description?: string;
        websiteUrl?: string;
        primaryCategory: string;
        subcategories?: string[];
        espProvider: 'beehiiv' | 'convertkit' | 'mailchimp' | 'substack' | 'other';
        espApiKey: string;
        espPublicationId?: string;
        espListId?: string;
      };

      const [created] = await app.db
        .insert(newsletters)
        .values({
          publisherId: userId,
          name: body.name,
          description: body.description ?? null,
          websiteUrl: body.websiteUrl ?? null,
          primaryCategory: body.primaryCategory,
          subcategories: body.subcategories ?? [],
          espProvider: body.espProvider,
          espConfig: {
            apiKey: body.espApiKey,
            publicationId: body.espPublicationId ?? null,
            listId: body.espListId ?? null,
            webhookSecret: crypto.randomUUID(),
            lastSyncAt: null,
            syncStatus: 'disconnected',
            syncError: null,
          },
        })
        .returning();

      return reply.status(201).send({
        success: true as const,
        data: formatNewsletter(created!),
      });
    },
  );

  // Update a newsletter
  app.patch(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Newsletter'],
        summary: 'Update a newsletter',
        params: z.object({ id: commonSchemas.id }),
        body: newsletterSchemas.updateNewsletter,
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { id } = request.params as { id: string };
      const updates = request.body as {
        name?: string;
        description?: string;
        websiteUrl?: string;
        primaryCategory?: string;
        subcategories?: string[];
      };

      // Verify ownership
      const existing = await app.db.query.newsletters.findFirst({
        where: and(eq(newsletters.id, id), eq(newsletters.publisherId, userId)),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Newsletter not found' },
        });
      }

      const updatePayload: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.description !== undefined) updatePayload.description = updates.description;
      if (updates.websiteUrl !== undefined) updatePayload.websiteUrl = updates.websiteUrl;
      if (updates.primaryCategory !== undefined) updatePayload.primaryCategory = updates.primaryCategory;
      if (updates.subcategories !== undefined) updatePayload.subcategories = updates.subcategories;

      const [updated] = await app.db
        .update(newsletters)
        .set(updatePayload)
        .where(eq(newsletters.id, id))
        .returning();

      return {
        success: true as const,
        data: formatNewsletter(updated!),
      };
    },
  );

  // Delete a newsletter
  app.delete(
    '/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Newsletter'],
        summary: 'Delete a newsletter',
        params: z.object({ id: commonSchemas.id }),
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { id } = request.params as { id: string };

      // Verify ownership
      const existing = await app.db.query.newsletters.findFirst({
        where: and(eq(newsletters.id, id), eq(newsletters.publisherId, userId)),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Newsletter not found' },
        });
      }

      await app.db.delete(newsletters).where(eq(newsletters.id, id));

      return {
        success: true as const,
        data: { message: 'Newsletter deleted' },
      };
    },
  );
}
