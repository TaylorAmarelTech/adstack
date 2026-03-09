import type { FastifyInstance } from 'fastify';
import { publisherSchemas } from '@adstack/shared';
import { eq } from 'drizzle-orm';
import { publishers } from '../../db/schema/index.js';

export async function profileRoutes(app: FastifyInstance) {
  // Get publisher profile
  app.get(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Publisher'],
        summary: 'Get publisher profile',
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const publisher = await app.db.query.publishers.findFirst({
        where: eq(publishers.id, userId),
      });

      if (!publisher) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Publisher profile not found' },
        });
      }

      return {
        success: true as const,
        data: {
          id: publisher.id,
          email: publisher.email,
          name: publisher.name,
          companyName: publisher.companyName,
          avatarUrl: publisher.avatarUrl,
          plan: publisher.plan,
          createdAt: publisher.createdAt.toISOString(),
        },
      };
    },
  );

  // Update publisher profile
  app.patch(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Publisher'],
        summary: 'Update publisher profile',
        body: publisherSchemas.updatePublisher,
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const updates = request.body as {
        name?: string;
        companyName?: string;
        avatarUrl?: string;
        settings?: {
          autoApproveAds?: boolean;
          autoApproveCategories?: string[];
          agentMode?: 'manual' | 'semi_auto' | 'full_auto';
        };
      };

      // Verify publisher exists
      const existing = await app.db.query.publishers.findFirst({
        where: eq(publishers.id, userId),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Publisher profile not found' },
        });
      }

      // Build update payload — merge settings if provided
      const updatePayload: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.companyName !== undefined) updatePayload.companyName = updates.companyName;
      if (updates.avatarUrl !== undefined) updatePayload.avatarUrl = updates.avatarUrl;

      if (updates.settings) {
        const mergedSettings = {
          ...existing.settings,
          ...updates.settings,
        };
        updatePayload.settings = mergedSettings;
      }

      const [updated] = await app.db
        .update(publishers)
        .set(updatePayload)
        .where(eq(publishers.id, userId))
        .returning();

      const u = updated!;
      return {
        success: true as const,
        data: {
          id: u.id,
          email: u.email,
          name: u.name,
          companyName: u.companyName,
          avatarUrl: u.avatarUrl,
          plan: u.plan,
          createdAt: u.createdAt.toISOString(),
        },
      };
    },
  );
}
