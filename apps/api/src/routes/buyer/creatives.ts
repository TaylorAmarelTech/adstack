import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { campaignSchemas, commonSchemas } from '@adstack/shared';
import { eq, and } from 'drizzle-orm';
import { campaigns, creatives } from '../../db/schema/index.js';

/**
 * Verify that a campaign belongs to the authenticated advertiser.
 * Returns the campaign if found, or sends a 404 and returns null.
 */
async function verifyCampaignOwnership(
  app: FastifyInstance,
  userId: string,
  campaignId: string,
  reply: import('fastify').FastifyReply,
) {
  const campaign = await app.db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, campaignId), eq(campaigns.advertiserId, userId)),
  });

  if (!campaign) {
    reply.status(404).send({
      success: false as const,
      error: { code: 'NOT_FOUND', message: 'Campaign not found' },
    });
    return null;
  }

  return campaign;
}

export async function creativeRoutes(app: FastifyInstance) {
  // GET / — List creatives for a campaign
  app.get(
    '/',
    {
      schema: {
        tags: ['Creative'],
        summary: 'List creatives for a campaign',
        params: z.object({ campaignId: commonSchemas.id }),
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { campaignId } = request.params as { campaignId: string };

      const campaign = await verifyCampaignOwnership(app, user.id, campaignId, reply);
      if (!campaign) return;

      const results = await app.db.query.creatives.findMany({
        where: eq(creatives.campaignId, campaignId),
      });

      return {
        success: true as const,
        data: results.map((cr) => ({
          id: cr.id,
          campaignId: cr.campaignId,
          format: cr.format,
          headline: cr.headline,
          body: cr.body,
          ctaText: cr.ctaText,
          ctaUrl: cr.ctaUrl,
          imageUrl: cr.imageUrl,
          variants: cr.variants,
          moderationStatus: cr.moderationStatus,
          moderationNotes: cr.moderationNotes,
          isActive: cr.isActive,
          createdAt: cr.createdAt.toISOString(),
        })),
      };
    },
  );

  // POST / — Create a creative for a campaign
  app.post(
    '/',
    {
      schema: {
        tags: ['Creative'],
        summary: 'Create a creative',
        params: z.object({ campaignId: commonSchemas.id }),
        body: campaignSchemas.createCreative,
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { campaignId } = request.params as { campaignId: string };
      const body = request.body as z.infer<typeof campaignSchemas.createCreative>;

      const campaign = await verifyCampaignOwnership(app, user.id, campaignId, reply);
      if (!campaign) return;

      const [created] = await app.db
        .insert(creatives)
        .values({
          campaignId,
          format: body.format,
          headline: body.headline,
          body: body.body,
          ctaText: body.ctaText,
          ctaUrl: body.ctaUrl,
          imageUrl: body.imageUrl ?? null,
          moderationStatus: 'pending',
        })
        .returning();

      const c = created!;
      return reply.status(201).send({
        success: true as const,
        data: {
          id: c.id,
          campaignId: c.campaignId,
          format: c.format,
          headline: c.headline,
          body: c.body,
          ctaText: c.ctaText,
          ctaUrl: c.ctaUrl,
          imageUrl: c.imageUrl,
          variants: c.variants,
          moderationStatus: c.moderationStatus,
          moderationNotes: c.moderationNotes,
          isActive: c.isActive,
          createdAt: c.createdAt.toISOString(),
        },
      });
    },
  );

  // PATCH /:creativeId — Update a creative
  app.patch(
    '/:creativeId',
    {
      schema: {
        tags: ['Creative'],
        summary: 'Update a creative',
        params: z.object({
          campaignId: commonSchemas.id,
          creativeId: commonSchemas.id,
        }),
        body: z.object({
          headline: z.string().min(1).max(200).optional(),
          body: z.string().min(1).max(2000).optional(),
          ctaText: z.string().min(1).max(50).optional(),
          ctaUrl: z.string().url().optional(),
          imageUrl: z.string().url().nullable().optional(),
          isActive: z.boolean().optional(),
        }),
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { campaignId, creativeId } = request.params as {
        campaignId: string;
        creativeId: string;
      };
      const body = request.body as {
        headline?: string;
        body?: string;
        ctaText?: string;
        ctaUrl?: string;
        imageUrl?: string | null;
        isActive?: boolean;
      };

      const campaign = await verifyCampaignOwnership(app, user.id, campaignId, reply);
      if (!campaign) return;

      // Verify the creative belongs to this campaign
      const existing = await app.db.query.creatives.findFirst({
        where: and(eq(creatives.id, creativeId), eq(creatives.campaignId, campaignId)),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Creative not found' },
        });
      }

      // Build update values
      const updateValues: Record<string, unknown> = {};
      let contentChanged = false;

      if (body.headline !== undefined) { updateValues.headline = body.headline; contentChanged = true; }
      if (body.body !== undefined) { updateValues.body = body.body; contentChanged = true; }
      if (body.ctaText !== undefined) { updateValues.ctaText = body.ctaText; contentChanged = true; }
      if (body.ctaUrl !== undefined) { updateValues.ctaUrl = body.ctaUrl; contentChanged = true; }
      if (body.imageUrl !== undefined) { updateValues.imageUrl = body.imageUrl; contentChanged = true; }
      if (body.isActive !== undefined) { updateValues.isActive = body.isActive; }

      // Reset moderation if content changed
      if (contentChanged) {
        updateValues.moderationStatus = 'pending';
        updateValues.moderationNotes = null;
      }

      if (Object.keys(updateValues).length === 0) {
        return {
          success: true as const,
          data: {
            id: existing.id,
            campaignId: existing.campaignId,
            format: existing.format,
            headline: existing.headline,
            body: existing.body,
            ctaText: existing.ctaText,
            ctaUrl: existing.ctaUrl,
            imageUrl: existing.imageUrl,
            variants: existing.variants,
            moderationStatus: existing.moderationStatus,
            moderationNotes: existing.moderationNotes,
            isActive: existing.isActive,
            createdAt: existing.createdAt.toISOString(),
          },
        };
      }

      const [updated] = await app.db
        .update(creatives)
        .set(updateValues)
        .where(and(eq(creatives.id, creativeId), eq(creatives.campaignId, campaignId)))
        .returning();

      const u = updated!;
      return {
        success: true as const,
        data: {
          id: u.id,
          campaignId: u.campaignId,
          format: u.format,
          headline: u.headline,
          body: u.body,
          ctaText: u.ctaText,
          ctaUrl: u.ctaUrl,
          imageUrl: u.imageUrl,
          variants: u.variants,
          moderationStatus: u.moderationStatus,
          moderationNotes: u.moderationNotes,
          isActive: u.isActive,
          createdAt: u.createdAt.toISOString(),
        },
      };
    },
  );

  // DELETE /:creativeId — Delete a creative
  app.delete(
    '/:creativeId',
    {
      schema: {
        tags: ['Creative'],
        summary: 'Delete a creative',
        params: z.object({
          campaignId: commonSchemas.id,
          creativeId: commonSchemas.id,
        }),
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { campaignId, creativeId } = request.params as {
        campaignId: string;
        creativeId: string;
      };

      const campaign = await verifyCampaignOwnership(app, user.id, campaignId, reply);
      if (!campaign) return;

      // Verify the creative belongs to this campaign
      const existing = await app.db.query.creatives.findFirst({
        where: and(eq(creatives.id, creativeId), eq(creatives.campaignId, campaignId)),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Creative not found' },
        });
      }

      await app.db
        .delete(creatives)
        .where(and(eq(creatives.id, creativeId), eq(creatives.campaignId, campaignId)));

      return reply.status(200).send({
        success: true as const,
        data: { id: creativeId },
      });
    },
  );
}
