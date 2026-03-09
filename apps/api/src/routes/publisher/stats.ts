import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { newsletters, adPlacements } from '../../db/schema/index.js';

export async function statsRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Publisher'],
        summary: 'Get aggregated publisher stats',
      },
    },
    async (request) => {
      const userId = request.user!.id;

      // Aggregate newsletter stats
      const [newsletterStats] = await app.db
        .select({
          newsletterCount: sql<number>`count(*)::int`,
          totalSubscribers: sql<number>`coalesce(sum(${newsletters.subscriberCount}), 0)::int`,
          avgOpenRate: sql<number>`coalesce(avg(${newsletters.avgOpenRate}), 0)::real`,
        })
        .from(newsletters)
        .where(eq(newsletters.publisherId, userId));

      // Revenue from ad_placements in the last 30 days
      // Join newsletters to filter by publisher ownership
      const [revenueRow] = await app.db
        .select({
          revenue30d: sql<number>`coalesce(sum(${adPlacements.publisherPayout}), 0)::real`,
        })
        .from(adPlacements)
        .innerJoin(newsletters, eq(adPlacements.newsletterId, newsletters.id))
        .where(
          sql`${newsletters.publisherId} = ${userId} AND ${adPlacements.placementDate} >= now() - interval '30 days'`,
        );

      return {
        success: true as const,
        data: {
          newsletterCount: newsletterStats?.newsletterCount ?? 0,
          totalSubscribers: newsletterStats?.totalSubscribers ?? 0,
          avgOpenRate: newsletterStats?.avgOpenRate ?? 0,
          revenue30d: revenueRow?.revenue30d ?? 0,
        },
      };
    },
  );
}
