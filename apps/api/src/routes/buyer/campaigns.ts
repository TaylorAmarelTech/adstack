import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { campaignSchemas, commonSchemas } from '@adstack/shared';
import { eq, and, sql } from 'drizzle-orm';
import { campaigns } from '../../db/schema/index.js';

export async function campaignRoutes(app: FastifyInstance) {
  // GET / — List campaigns for the authenticated advertiser
  app.get(
    '/',
    {
      schema: {
        tags: ['Campaign'],
        summary: 'List campaigns',
        querystring: commonSchemas.paginationQuery,
      },
      preHandler: [app.authenticate],
    },
    async (request) => {
      const user = request.user!;
      const { page, limit } = request.query as { page: number; limit: number };
      const offset = (page - 1) * limit;

      const results = await app.db.query.campaigns.findMany({
        where: eq(campaigns.advertiserId, user.id),
        limit,
        offset,
        orderBy: (campaigns, { desc }) => [desc(campaigns.createdAt)],
      });

      const [countRow] = await app.db
        .select({ count: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(eq(campaigns.advertiserId, user.id));

      const total = countRow?.count ?? 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true as const,
        data: results.map((c) => ({
          id: c.id,
          advertiserId: c.advertiserId,
          name: c.name,
          status: c.status,
          totalBudget: c.totalBudget,
          dailyBudgetCap: c.dailyBudgetCap,
          spentToDate: c.spentToDate,
          pricingModel: c.pricingModel,
          maxCPM: c.maxCPM,
          maxCPC: c.maxCPC,
          targeting: c.targeting,
          performance: {
            totalImpressions: c.totalImpressions,
            totalClicks: c.totalClicks,
            totalSpend: c.spentToDate,
            avgCTR: c.avgCTR,
            placementCount: c.placementCount,
          },
          startDate: c.startDate.toISOString(),
          endDate: c.endDate.toISOString(),
          createdAt: c.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages },
      };
    },
  );

  // GET /:id — Get a single campaign
  app.get(
    '/:id',
    {
      schema: {
        tags: ['Campaign'],
        summary: 'Get campaign details',
        params: z.object({ id: commonSchemas.id }),
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const campaign = await app.db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, id), eq(campaigns.advertiserId, user.id)),
      });

      if (!campaign) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Campaign not found' },
        });
      }

      return {
        success: true as const,
        data: {
          id: campaign.id,
          advertiserId: campaign.advertiserId,
          name: campaign.name,
          status: campaign.status,
          totalBudget: campaign.totalBudget,
          dailyBudgetCap: campaign.dailyBudgetCap,
          spentToDate: campaign.spentToDate,
          pricingModel: campaign.pricingModel,
          maxCPM: campaign.maxCPM,
          maxCPC: campaign.maxCPC,
          targeting: campaign.targeting,
          preferredDays: campaign.preferredDays,
          performance: {
            totalImpressions: campaign.totalImpressions,
            totalClicks: campaign.totalClicks,
            totalSpend: campaign.spentToDate,
            avgCTR: campaign.avgCTR,
            placementCount: campaign.placementCount,
          },
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate.toISOString(),
          createdAt: campaign.createdAt.toISOString(),
          updatedAt: campaign.updatedAt.toISOString(),
        },
      };
    },
  );

  // POST / — Create a new campaign
  app.post(
    '/',
    {
      schema: {
        tags: ['Campaign'],
        summary: 'Create a new campaign',
        body: campaignSchemas.createCampaign,
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body as z.infer<typeof campaignSchemas.createCampaign>;

      // Build targeting with defaults for optional fields
      const targeting = {
        audienceDescription: body.targeting.audienceDescription,
        audienceEmbeddingId: null,
        categories: body.targeting.categories ?? [],
        geoTargeting: body.targeting.geoTargeting ?? [],
        minEngagementScore: body.targeting.minEngagementScore ?? 0,
        minSubscriberCount: body.targeting.minSubscriberCount ?? 0,
        excludeNewsletters: body.targeting.excludeNewsletters ?? [],
        targetClusterIds: [],
      };

      const [created] = await app.db
        .insert(campaigns)
        .values({
          advertiserId: user.id,
          name: body.name,
          status: 'draft',
          totalBudget: body.totalBudget,
          dailyBudgetCap: body.dailyBudgetCap,
          pricingModel: body.pricingModel,
          maxCPM: body.maxCPM ?? null,
          maxCPC: body.maxCPC ?? null,
          targeting,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          preferredDays: body.preferredDays ?? [],
        })
        .returning();

      return reply.status(201).send({
        success: true as const,
        data: {
          id: created!.id,
          advertiserId: created!.advertiserId,
          name: created!.name,
          status: created!.status,
          totalBudget: created!.totalBudget,
          dailyBudgetCap: created!.dailyBudgetCap,
          spentToDate: created!.spentToDate,
          pricingModel: created!.pricingModel,
          maxCPM: created!.maxCPM,
          maxCPC: created!.maxCPC,
          targeting: created!.targeting,
          preferredDays: created!.preferredDays,
          performance: {
            totalImpressions: created!.totalImpressions,
            totalClicks: created!.totalClicks,
            totalSpend: created!.spentToDate,
            avgCTR: created!.avgCTR,
            placementCount: created!.placementCount,
          },
          startDate: created!.startDate.toISOString(),
          endDate: created!.endDate.toISOString(),
          createdAt: created!.createdAt.toISOString(),
          updatedAt: created!.updatedAt.toISOString(),
        },
      });
    },
  );

  // PATCH /:id — Update a campaign
  app.patch(
    '/:id',
    {
      schema: {
        tags: ['Campaign'],
        summary: 'Update a campaign',
        params: z.object({ id: commonSchemas.id }),
        body: campaignSchemas.updateCampaign,
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof campaignSchemas.updateCampaign>;

      // Ownership check
      const existing = await app.db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, id), eq(campaigns.advertiserId, user.id)),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Campaign not found' },
        });
      }

      // Build update values — only include fields that were provided
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) updateValues.name = body.name;
      if (body.totalBudget !== undefined) updateValues.totalBudget = body.totalBudget;
      if (body.dailyBudgetCap !== undefined) updateValues.dailyBudgetCap = body.dailyBudgetCap;
      if (body.status !== undefined) updateValues.status = body.status;
      if (body.maxCPM !== undefined) updateValues.maxCPM = body.maxCPM;
      if (body.maxCPC !== undefined) updateValues.maxCPC = body.maxCPC;
      if (body.endDate !== undefined) updateValues.endDate = new Date(body.endDate);

      const [updated] = await app.db
        .update(campaigns)
        .set(updateValues)
        .where(and(eq(campaigns.id, id), eq(campaigns.advertiserId, user.id)))
        .returning();

      return {
        success: true as const,
        data: {
          id: updated!.id,
          advertiserId: updated!.advertiserId,
          name: updated!.name,
          status: updated!.status,
          totalBudget: updated!.totalBudget,
          dailyBudgetCap: updated!.dailyBudgetCap,
          spentToDate: updated!.spentToDate,
          pricingModel: updated!.pricingModel,
          maxCPM: updated!.maxCPM,
          maxCPC: updated!.maxCPC,
          targeting: updated!.targeting,
          preferredDays: updated!.preferredDays,
          performance: {
            totalImpressions: updated!.totalImpressions,
            totalClicks: updated!.totalClicks,
            totalSpend: updated!.spentToDate,
            avgCTR: updated!.avgCTR,
            placementCount: updated!.placementCount,
          },
          startDate: updated!.startDate.toISOString(),
          endDate: updated!.endDate.toISOString(),
          createdAt: updated!.createdAt.toISOString(),
          updatedAt: updated!.updatedAt.toISOString(),
        },
      };
    },
  );

  // DELETE /:id — Delete a draft campaign
  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Campaign'],
        summary: 'Delete a draft campaign',
        params: z.object({ id: commonSchemas.id }),
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      // Ownership check
      const existing = await app.db.query.campaigns.findFirst({
        where: and(eq(campaigns.id, id), eq(campaigns.advertiserId, user.id)),
      });

      if (!existing) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Campaign not found' },
        });
      }

      if (existing.status !== 'draft') {
        return reply.status(409).send({
          success: false as const,
          error: {
            code: 'CONFLICT',
            message: 'Only draft campaigns can be deleted',
          },
        });
      }

      await app.db
        .delete(campaigns)
        .where(and(eq(campaigns.id, id), eq(campaigns.advertiserId, user.id)));

      return reply.status(200).send({
        success: true as const,
        data: { id },
      });
    },
  );
}
