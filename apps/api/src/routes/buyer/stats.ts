import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { campaigns } from '../../db/schema/index.js';

export async function statsRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Buyer'],
        summary: 'Get aggregated buyer/advertiser stats',
      },
    },
    async (request) => {
      const userId = request.user!.id;

      // Count active campaigns
      const [activeRow] = await app.db
        .select({
          activeCampaigns: sql<number>`count(*)::int`,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.advertiserId, userId),
            eq(campaigns.status, 'active'),
          ),
        );

      // Aggregate spend and performance across all campaigns
      const [totalsRow] = await app.db
        .select({
          totalSpend: sql<number>`coalesce(sum(${campaigns.spentToDate}), 0)::real`,
          totalImpressions: sql<number>`coalesce(sum(${campaigns.totalImpressions}), 0)::int`,
          totalClicks: sql<number>`coalesce(sum(${campaigns.totalClicks}), 0)::int`,
        })
        .from(campaigns)
        .where(eq(campaigns.advertiserId, userId));

      return {
        success: true as const,
        data: {
          activeCampaigns: activeRow?.activeCampaigns ?? 0,
          totalSpend: totalsRow?.totalSpend ?? 0,
          totalImpressions: totalsRow?.totalImpressions ?? 0,
          totalClicks: totalsRow?.totalClicks ?? 0,
        },
      };
    },
  );
}
