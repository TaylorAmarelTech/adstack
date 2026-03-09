import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { advertisers } from '../../db/schema/index.js';

export async function profileRoutes(app: FastifyInstance) {
  // GET / — Get advertiser profile
  app.get(
    '/',
    {
      schema: {
        tags: ['Buyer'],
        summary: 'Get advertiser profile',
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;

      const advertiser = await app.db.query.advertisers.findFirst({
        where: eq(advertisers.id, user.id),
      });

      if (!advertiser) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Advertiser profile not found' },
        });
      }

      return {
        success: true as const,
        data: {
          id: advertiser.id,
          email: advertiser.email,
          name: advertiser.name,
          companyName: advertiser.companyName,
          websiteUrl: advertiser.websiteUrl,
          settings: advertiser.settings,
          createdAt: advertiser.createdAt.toISOString(),
          updatedAt: advertiser.updatedAt.toISOString(),
        },
      };
    },
  );

  // PATCH / — Update advertiser profile
  app.patch(
    '/',
    {
      schema: {
        tags: ['Buyer'],
        summary: 'Update advertiser profile',
        body: z.object({
          name: z.string().min(1).max(100).optional(),
          companyName: z.string().min(1).max(200).optional(),
          websiteUrl: z.string().url().optional(),
          settings: z
            .object({
              agentEnabled: z.boolean().optional(),
              agentConfig: z
                .object({
                  maxCPM: z.number().min(1).max(500).optional(),
                  maxDailySpend: z.number().min(1).optional(),
                  autoApproveBelow: z.number().min(0).optional(),
                  targetCategories: z.array(z.string()).optional(),
                  excludeCategories: z.array(z.string()).optional(),
                })
                .optional(),
              notificationPreferences: z
                .object({
                  email: z.boolean().optional(),
                  webhook: z.boolean().optional(),
                  webhookUrl: z.string().url().nullable().optional(),
                })
                .optional(),
            })
            .optional(),
        }),
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body as {
        name?: string;
        companyName?: string;
        websiteUrl?: string;
        settings?: Record<string, unknown>;
      };

      // Verify advertiser exists
      const existing = await app.db.query.advertisers.findFirst({
        where: eq(advertisers.id, user.id),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Advertiser profile not found' },
        });
      }

      // Build update values — only include fields that were provided
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) updateValues.name = body.name;
      if (body.companyName !== undefined) updateValues.companyName = body.companyName;
      if (body.websiteUrl !== undefined) updateValues.websiteUrl = body.websiteUrl;

      // Deep-merge settings if provided
      if (body.settings !== undefined) {
        const currentSettings = existing.settings ?? {};
        updateValues.settings = {
          ...currentSettings,
          ...body.settings,
          agentConfig: {
            ...(currentSettings as Record<string, unknown>).agentConfig as Record<string, unknown> | undefined,
            ...(body.settings.agentConfig as Record<string, unknown> | undefined),
          },
          notificationPreferences: {
            ...(currentSettings as Record<string, unknown>).notificationPreferences as Record<string, unknown> | undefined,
            ...(body.settings.notificationPreferences as Record<string, unknown> | undefined),
          },
        };
      }

      const [updated] = await app.db
        .update(advertisers)
        .set(updateValues)
        .where(eq(advertisers.id, user.id))
        .returning();

      const u = updated!;
      return {
        success: true as const,
        data: {
          id: u.id,
          email: u.email,
          name: u.name,
          companyName: u.companyName,
          websiteUrl: u.websiteUrl,
          settings: u.settings,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        },
      };
    },
  );
}
