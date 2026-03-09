import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { commonSchemas } from '@adstack/shared';
import { eq, sql, ilike, asc, desc } from 'drizzle-orm';
import { newsletters, adSlots, subscriberClusters } from '../../db/schema/index.js';

/**
 * Public newsletter discovery endpoints.
 * These let advertisers (and anonymous visitors) browse the marketplace.
 */
export async function discoverRoutes(app: FastifyInstance) {
  // ----------------------------------------------------------------
  // GET /newsletters — list active newsletters with public info
  // ----------------------------------------------------------------
  app.get(
    '/newsletters',
    {
      preHandler: [app.optionalAuth],
      schema: {
        tags: ['Marketplace'],
        summary: 'Discover newsletters',
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          category: z.string().optional(),
          search: z.string().optional(),
          sortBy: z.enum(['subscribers', 'openRate']).default('subscribers'),
          sortOrder: z.enum(['asc', 'desc']).default('desc'),
        }),
      },
    },
    async (request) => {
      const { page, limit, category, search, sortBy, sortOrder } =
        request.query as {
          page: number;
          limit: number;
          category?: string;
          search?: string;
          sortBy: 'subscribers' | 'openRate';
          sortOrder: 'asc' | 'desc';
        };

      const offset = (page - 1) * limit;

      // Build WHERE conditions dynamically
      const conditions: ReturnType<typeof eq>[] = [];

      // Only show active newsletters publicly
      conditions.push(eq(newsletters.status, 'active'));

      if (category) {
        conditions.push(eq(newsletters.primaryCategory, category));
      }

      if (search) {
        conditions.push(ilike(newsletters.name, `%${search}%`));
      }

      const whereClause =
        conditions.length === 1
          ? conditions[0]!
          : sql`${sql.join(
              conditions.map((c) => sql`(${c})`),
              sql` AND `,
            )}`;

      // Determine ordering
      const orderColumn =
        sortBy === 'openRate'
          ? newsletters.avgOpenRate
          : newsletters.subscriberCount;
      const orderFn = sortOrder === 'asc' ? asc : desc;

      // Fetch newsletters
      const results = await app.db
        .select({
          id: newsletters.id,
          name: newsletters.name,
          description: newsletters.description,
          primaryCategory: newsletters.primaryCategory,
          subcategories: newsletters.subcategories,
          subscriberCount: newsletters.subscriberCount,
          avgOpenRate: newsletters.avgOpenRate,
          avgClickRate: newsletters.avgClickRate,
        })
        .from(newsletters)
        .where(whereClause)
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset);

      // Count available ad slots per newsletter (active only)
      const newsletterIds = results.map((r) => r.id);
      let slotCounts: Record<string, number> = {};

      if (newsletterIds.length > 0) {
        const slotRows = await app.db
          .select({
            newsletterId: adSlots.newsletterId,
            count: sql<number>`count(*)::int`,
          })
          .from(adSlots)
          .where(
            sql`${adSlots.newsletterId} IN (${sql.join(
              newsletterIds.map((id) => sql`${id}`),
              sql`, `,
            )}) AND ${adSlots.isActive} = true`,
          )
          .groupBy(adSlots.newsletterId);

        slotCounts = Object.fromEntries(
          slotRows.map((r) => [r.newsletterId, r.count]),
        );
      }

      // Total count for pagination
      const [countRow] = await app.db
        .select({ count: sql<number>`count(*)::int` })
        .from(newsletters)
        .where(whereClause);

      const total = countRow?.count ?? 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true as const,
        data: results.map((n) => ({
          id: n.id,
          name: n.name,
          description: n.description,
          primaryCategory: n.primaryCategory,
          subcategories: n.subcategories ?? [],
          subscriberCount: n.subscriberCount,
          avgOpenRate: n.avgOpenRate,
          avgClickRate: n.avgClickRate,
          availableSlotCount: slotCounts[n.id] ?? 0,
        })),
        pagination: { page, limit, total, totalPages },
      };
    },
  );

  // ----------------------------------------------------------------
  // GET /newsletters/:id — detailed public profile of a newsletter
  // ----------------------------------------------------------------
  app.get(
    '/newsletters/:id',
    {
      preHandler: [app.optionalAuth],
      schema: {
        tags: ['Marketplace'],
        summary: 'Get newsletter public profile',
        params: z.object({ id: commonSchemas.id }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const newsletter = await app.db.query.newsletters.findFirst({
        where: eq(newsletters.id, id),
      });

      if (!newsletter || newsletter.status !== 'active') {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Newsletter not found' },
        });
      }

      // Get active ad slots with public pricing info
      const slots = await app.db
        .select({
          id: adSlots.id,
          placement: adSlots.placement,
          format: adSlots.format,
          maxFrequency: adSlots.maxFrequency,
          floorCPM: adSlots.floorCPM,
          preferredCategories: adSlots.preferredCategories,
        })
        .from(adSlots)
        .where(
          sql`${adSlots.newsletterId} = ${id} AND ${adSlots.isActive} = true`,
        );

      // Base public profile (available to all)
      const profile: Record<string, unknown> = {
        id: newsletter.id,
        name: newsletter.name,
        description: newsletter.description,
        primaryCategory: newsletter.primaryCategory,
        subcategories: newsletter.subcategories ?? [],
        metrics: {
          subscriberCount: newsletter.subscriberCount,
          activeSubscribers: newsletter.activeSubscribers,
          avgOpenRate: newsletter.avgOpenRate,
          avgClickRate: newsletter.avgClickRate,
          sendFrequency: newsletter.sendFrequency,
        },
        availableSlots: slots.map((s) => ({
          id: s.id,
          placement: s.placement,
          format: s.format,
          maxFrequency: s.maxFrequency,
          floorCPM: s.floorCPM,
          preferredCategories: s.preferredCategories ?? [],
        })),
      };

      // If authenticated as advertiser, include audience insights
      if (request.user && request.user.role === 'advertiser') {
        const clusters = await app.db
          .select({
            label: subscriberClusters.label,
            description: subscriberClusters.description,
            subscriberCount: subscriberClusters.subscriberCount,
            avgEngagementScore: subscriberClusters.avgEngagementScore,
            topInterests: subscriberClusters.topInterests,
          })
          .from(subscriberClusters)
          .where(eq(subscriberClusters.newsletterId, id))
          .orderBy(desc(subscriberClusters.subscriberCount))
          .limit(10);

        profile.audienceInsights = {
          topClusters: clusters.map((c) => ({
            label: c.label,
            description: c.description,
            subscriberCount: c.subscriberCount,
            avgEngagementScore: c.avgEngagementScore,
            topInterests: c.topInterests ?? [],
          })),
          totalClusters: clusters.length,
        };
      }

      return {
        success: true as const,
        data: profile,
      };
    },
  );
}
