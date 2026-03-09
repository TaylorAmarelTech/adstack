import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { commonSchemas, newsletterSchemas } from '@adstack/shared';
import { eq, and } from 'drizzle-orm';
import { newsletters, adSlots } from '../../db/schema/index.js';

/** Helper to format an ad slot row into the standard API response shape */
function formatAdSlot(slot: typeof adSlots.$inferSelect) {
  return {
    id: slot.id,
    newsletterId: slot.newsletterId,
    placement: slot.placement,
    format: slot.format,
    maxFrequency: slot.maxFrequency,
    floorCPM: slot.floorCPM,
    preferredCategories: slot.preferredCategories ?? [],
    excludedCategories: slot.excludedCategories ?? [],
    requiresApproval: slot.requiresApproval,
    isActive: slot.isActive,
    createdAt: slot.createdAt.toISOString(),
  };
}

/**
 * Verify that a newsletter exists and belongs to the authenticated publisher.
 * Returns the newsletter row or null if not found / not owned.
 */
async function verifyNewsletterOwnership(
  app: FastifyInstance,
  newsletterId: string,
  publisherId: string,
) {
  return app.db.query.newsletters.findFirst({
    where: and(
      eq(newsletters.id, newsletterId),
      eq(newsletters.publisherId, publisherId),
    ),
  });
}

export async function adSlotRoutes(app: FastifyInstance) {
  // List ad slots for a newsletter
  app.get(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Ad Slot'],
        summary: 'List ad slots for a newsletter',
        params: z.object({ newsletterId: commonSchemas.id }),
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { newsletterId } = request.params as { newsletterId: string };

      // Verify newsletter ownership
      const newsletter = await verifyNewsletterOwnership(app, newsletterId, userId);
      if (!newsletter) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Newsletter not found' },
        });
      }

      const slots = await app.db.query.adSlots.findMany({
        where: eq(adSlots.newsletterId, newsletterId),
      });

      return {
        success: true as const,
        data: slots.map(formatAdSlot),
      };
    },
  );

  // Create an ad slot
  app.post(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Ad Slot'],
        summary: 'Create an ad slot',
        params: z.object({ newsletterId: commonSchemas.id }),
        body: newsletterSchemas.createAdSlot,
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { newsletterId } = request.params as { newsletterId: string };
      const body = request.body as {
        placement: 'top_banner' | 'mid_content' | 'bottom' | 'dedicated' | 'classified';
        format: 'text_link' | 'text_block' | 'image_text' | 'native_mention' | 'sponsored_section';
        maxFrequency: 'every_issue' | 'weekly' | 'biweekly' | 'monthly';
        floorCPM: number;
        preferredCategories?: string[];
        excludedCategories?: string[];
        requiresApproval: boolean;
      };

      // Verify newsletter ownership
      const newsletter = await verifyNewsletterOwnership(app, newsletterId, userId);
      if (!newsletter) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Newsletter not found' },
        });
      }

      const [created] = await app.db
        .insert(adSlots)
        .values({
          newsletterId,
          placement: body.placement,
          format: body.format,
          maxFrequency: body.maxFrequency,
          floorCPM: body.floorCPM,
          preferredCategories: body.preferredCategories ?? [],
          excludedCategories: body.excludedCategories ?? [],
          requiresApproval: body.requiresApproval,
        })
        .returning();

      return reply.status(201).send({
        success: true as const,
        data: formatAdSlot(created!),
      });
    },
  );

  // Update an ad slot
  app.patch(
    '/:slotId',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Ad Slot'],
        summary: 'Update an ad slot',
        params: z.object({
          newsletterId: commonSchemas.id,
          slotId: commonSchemas.id,
        }),
        body: newsletterSchemas.updateAdSlot,
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { newsletterId, slotId } = request.params as {
        newsletterId: string;
        slotId: string;
      };
      const updates = request.body as {
        placement?: string;
        format?: string;
        maxFrequency?: string;
        floorCPM?: number;
        preferredCategories?: string[];
        excludedCategories?: string[];
        requiresApproval?: boolean;
        isActive?: boolean;
      };

      // Verify newsletter ownership
      const newsletter = await verifyNewsletterOwnership(app, newsletterId, userId);
      if (!newsletter) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Newsletter not found' },
        });
      }

      // Verify ad slot exists and belongs to this newsletter
      const existing = await app.db.query.adSlots.findFirst({
        where: and(
          eq(adSlots.id, slotId),
          eq(adSlots.newsletterId, newsletterId),
        ),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Ad slot not found' },
        });
      }

      const updatePayload: Record<string, unknown> = {};

      if (updates.placement !== undefined) updatePayload.placement = updates.placement;
      if (updates.format !== undefined) updatePayload.format = updates.format;
      if (updates.maxFrequency !== undefined) updatePayload.maxFrequency = updates.maxFrequency;
      if (updates.floorCPM !== undefined) updatePayload.floorCPM = updates.floorCPM;
      if (updates.preferredCategories !== undefined) updatePayload.preferredCategories = updates.preferredCategories;
      if (updates.excludedCategories !== undefined) updatePayload.excludedCategories = updates.excludedCategories;
      if (updates.requiresApproval !== undefined) updatePayload.requiresApproval = updates.requiresApproval;
      if (updates.isActive !== undefined) updatePayload.isActive = updates.isActive;

      const [updated] = await app.db
        .update(adSlots)
        .set(updatePayload)
        .where(eq(adSlots.id, slotId))
        .returning();

      return {
        success: true as const,
        data: formatAdSlot(updated!),
      };
    },
  );

  // Delete an ad slot
  app.delete(
    '/:slotId',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Ad Slot'],
        summary: 'Delete an ad slot',
        params: z.object({
          newsletterId: commonSchemas.id,
          slotId: commonSchemas.id,
        }),
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { newsletterId, slotId } = request.params as {
        newsletterId: string;
        slotId: string;
      };

      // Verify newsletter ownership
      const newsletter = await verifyNewsletterOwnership(app, newsletterId, userId);
      if (!newsletter) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Newsletter not found' },
        });
      }

      // Verify ad slot exists and belongs to this newsletter
      const existing = await app.db.query.adSlots.findFirst({
        where: and(
          eq(adSlots.id, slotId),
          eq(adSlots.newsletterId, newsletterId),
        ),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Ad slot not found' },
        });
      }

      await app.db.delete(adSlots).where(eq(adSlots.id, slotId));

      return {
        success: true as const,
        data: { message: 'Ad slot deleted' },
      };
    },
  );
}
