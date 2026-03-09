import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { campaignSchemas, commonSchemas } from '@adstack/shared';
import { eq, and, sql, desc } from 'drizzle-orm';
import { newsletters, adSlots, campaigns } from '../../db/schema/index.js';

/**
 * Audience matching endpoints — requires authentication as an advertiser.
 *
 * MVP implementation: category + metrics-based matching (no embeddings yet).
 * When OpenAI integration lands the scoring will switch to cosine similarity
 * on 768-d subscriber embeddings.
 */
export async function matchRoutes(app: FastifyInstance) {
  // ----------------------------------------------------------------
  // POST /audience — find newsletters matching an audience query
  // ----------------------------------------------------------------
  app.post(
    '/audience',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Marketplace'],
        summary: 'Find newsletters matching audience criteria',
        body: campaignSchemas.matchingQuery,
      },
    },
    async (request, reply) => {
      const user = request.user!;

      if (user.role !== 'advertiser') {
        return reply.status(403).send({
          success: false as const,
          error: {
            code: 'FORBIDDEN',
            message: 'Only advertisers can use audience matching',
          },
        });
      }

      const body = request.body as z.infer<typeof campaignSchemas.matchingQuery>;
      const {
        filters,
        maxResults,
      } = body;

      const categories = filters?.categories ?? [];
      const minEngagementScore = filters?.minEngagementScore ?? 0;
      const minSubscriberCount = filters?.minSubscriberCount ?? 0;

      // ----- Build conditions -----
      const conditions: ReturnType<typeof eq>[] = [];

      // Only active newsletters
      conditions.push(eq(newsletters.status, 'active'));

      // Filter by minimum subscriber count
      if (minSubscriberCount > 0) {
        conditions.push(
          sql`${newsletters.subscriberCount} >= ${minSubscriberCount}`,
        );
      }

      // Filter by minimum engagement (avgOpenRate as proxy)
      if (minEngagementScore > 0) {
        conditions.push(
          sql`${newsletters.avgOpenRate} >= ${minEngagementScore}`,
        );
      }

      const whereClause =
        conditions.length === 1
          ? conditions[0]!
          : sql`${sql.join(
              conditions.map((c) => sql`(${c})`),
              sql` AND `,
            )}`;

      // Fetch candidate newsletters
      const candidates = await app.db
        .select({
          id: newsletters.id,
          name: newsletters.name,
          description: newsletters.description,
          primaryCategory: newsletters.primaryCategory,
          subcategories: newsletters.subcategories,
          subscriberCount: newsletters.subscriberCount,
          activeSubscribers: newsletters.activeSubscribers,
          avgOpenRate: newsletters.avgOpenRate,
          avgClickRate: newsletters.avgClickRate,
        })
        .from(newsletters)
        .where(whereClause)
        .orderBy(desc(newsletters.subscriberCount))
        .limit(200); // fetch a larger pool to score & re-rank

      // ----- Scoring -----
      // Composite score: 60% engagement (avgOpenRate) + 40% reach (normalised subscriber count)
      const ENGAGEMENT_WEIGHT = 0.6;
      const REACH_WEIGHT = 0.4;
      const CATEGORY_BONUS = 0.15; // bonus per matching category

      // Find the max subscriber count for normalisation (avoid division by zero)
      const maxSubs = Math.max(
        1,
        ...candidates.map((c) => c.subscriberCount),
      );

      type ScoredCandidate = (typeof candidates)[number] & {
        matchScore: number;
      };

      const scored: ScoredCandidate[] = candidates.map((c) => {
        // Base scores
        const engagementScore = c.avgOpenRate; // already 0–1
        const reachScore = c.subscriberCount / maxSubs;

        let score =
          engagementScore * ENGAGEMENT_WEIGHT + reachScore * REACH_WEIGHT;

        // Category overlap bonus
        if (categories.length > 0) {
          const newsletterCats = [
            c.primaryCategory,
            ...(c.subcategories ?? []),
          ];
          const overlap = categories.filter((cat) =>
            newsletterCats.includes(cat),
          ).length;
          score += overlap * CATEGORY_BONUS;
        }

        // Clamp to [0, 1]
        score = Math.min(1, Math.max(0, score));

        return { ...c, matchScore: Math.round(score * 1000) / 1000 };
      });

      // Sort by match score descending, take top N
      scored.sort((a, b) => b.matchScore - a.matchScore);
      const topMatches = scored.slice(0, maxResults);

      // Fetch ad slots for matched newsletters
      const matchedIds = topMatches.map((m) => m.id);
      let slotsByNewsletter: Record<
        string,
        {
          id: string;
          placement: string;
          format: string;
          floorCPM: number;
        }[]
      > = {};

      if (matchedIds.length > 0) {
        const slotsRows = await app.db
          .select({
            id: adSlots.id,
            newsletterId: adSlots.newsletterId,
            placement: adSlots.placement,
            format: adSlots.format,
            floorCPM: adSlots.floorCPM,
          })
          .from(adSlots)
          .where(
            sql`${adSlots.newsletterId} IN (${sql.join(
              matchedIds.map((id) => sql`${id}`),
              sql`, `,
            )}) AND ${adSlots.isActive} = true`,
          );

        for (const slot of slotsRows) {
          if (!slotsByNewsletter[slot.newsletterId]) {
            slotsByNewsletter[slot.newsletterId] = [];
          }
          slotsByNewsletter[slot.newsletterId]!.push({
            id: slot.id,
            placement: slot.placement,
            format: slot.format,
            floorCPM: slot.floorCPM,
          });
        }
      }

      return {
        success: true as const,
        data: topMatches.map((m) => ({
          newsletterId: m.id,
          newsletterName: m.name,
          matchScore: m.matchScore,
          audienceProfile: {
            subscriberCount: m.subscriberCount,
            activeSubscribers: m.activeSubscribers,
            avgOpenRate: m.avgOpenRate,
            avgClickRate: m.avgClickRate,
            primaryCategory: m.primaryCategory,
            subcategories: m.subcategories ?? [],
          },
          availableSlots: (slotsByNewsletter[m.id] ?? []).map((s) => ({
            id: s.id,
            placement: s.placement,
            format: s.format,
            floorCPM: s.floorCPM,
          })),
          estimatedReach: Math.round(m.activeSubscribers * m.avgOpenRate),
        })),
      };
    },
  );

  // ----------------------------------------------------------------
  // GET /estimate — estimate cost & performance for a placement
  // ----------------------------------------------------------------
  app.get(
    '/estimate',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Marketplace'],
        summary: 'Estimate reach, cost, and performance for a placement',
        querystring: z.object({
          newsletterId: commonSchemas.id,
          campaignId: commonSchemas.id,
        }),
      },
    },
    async (request, reply) => {
      const user = request.user!;

      if (user.role !== 'advertiser') {
        return reply.status(403).send({
          success: false as const,
          error: {
            code: 'FORBIDDEN',
            message: 'Only advertisers can request estimates',
          },
        });
      }

      const { newsletterId, campaignId } = request.query as {
        newsletterId: string;
        campaignId: string;
      };

      // Fetch newsletter
      const newsletter = await app.db.query.newsletters.findFirst({
        where: eq(newsletters.id, newsletterId),
      });

      if (!newsletter || newsletter.status !== 'active') {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Newsletter not found' },
        });
      }

      // Fetch campaign (must belong to user)
      const campaign = await app.db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, campaignId),
          eq(campaigns.advertiserId, user.id),
        ),
      });

      if (!campaign) {
        return reply.status(404).send({
          success: false as const,
          error: { code: 'NOT_FOUND', message: 'Campaign not found' },
        });
      }

      // Get the cheapest active ad slot for this newsletter
      const slots = await app.db
        .select({
          id: adSlots.id,
          placement: adSlots.placement,
          format: adSlots.format,
          floorCPM: adSlots.floorCPM,
        })
        .from(adSlots)
        .where(
          sql`${adSlots.newsletterId} = ${newsletterId} AND ${adSlots.isActive} = true`,
        );

      if (slots.length === 0) {
        return reply.status(404).send({
          success: false as const,
          error: {
            code: 'NO_SLOTS',
            message: 'This newsletter has no available ad slots',
          },
        });
      }

      // Use the cheapest slot for estimation
      const cheapestSlot = slots.reduce((min, s) =>
        s.floorCPM < min.floorCPM ? s : min,
      );

      // Estimate impressions = activeSubscribers * avgOpenRate
      const estimatedImpressions = Math.round(
        newsletter.activeSubscribers * newsletter.avgOpenRate,
      );

      // Estimate clicks = impressions * avgClickRate
      const estimatedClicks = Math.round(
        estimatedImpressions * newsletter.avgClickRate,
      );

      // Estimate cost = (impressions / 1000) * floorCPM
      const estimatedCost =
        Math.round((estimatedImpressions / 1000) * cheapestSlot.floorCPM * 100) / 100;

      // Audience overlap score (MVP: category match heuristic)
      const targeting = campaign.targeting as {
        categories?: string[];
        audienceDescription?: string;
      };
      const campaignCategories = targeting?.categories ?? [];
      const newsletterCats = [
        newsletter.primaryCategory,
        ...(newsletter.subcategories ?? []),
      ];
      const overlap = campaignCategories.filter((cat) =>
        newsletterCats.includes(cat),
      ).length;
      const maxPossible = Math.max(1, campaignCategories.length);
      const audienceOverlapScore =
        Math.round((overlap / maxPossible) * 1000) / 1000;

      return {
        success: true as const,
        data: {
          newsletterId,
          campaignId,
          slot: {
            id: cheapestSlot.id,
            placement: cheapestSlot.placement,
            format: cheapestSlot.format,
            floorCPM: cheapestSlot.floorCPM,
          },
          estimatedImpressions,
          estimatedClicks,
          estimatedCost,
          audienceOverlapScore,
          metrics: {
            subscriberCount: newsletter.subscriberCount,
            activeSubscribers: newsletter.activeSubscribers,
            avgOpenRate: newsletter.avgOpenRate,
            avgClickRate: newsletter.avgClickRate,
          },
        },
      };
    },
  );
}
