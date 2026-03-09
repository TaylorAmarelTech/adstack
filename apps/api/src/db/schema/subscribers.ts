import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  smallint,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { newsletters } from './newsletters';

export const subscriberStatusEnum = pgEnum('subscriber_status', [
  'active',
  'unsubscribed',
  'bounced',
  'complained',
]);

export const lifecycleStageEnum = pgEnum('lifecycle_stage', [
  'new',
  'active',
  'at_risk',
  'dormant',
  'churned',
]);

export const subscribers = pgTable(
  'subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailHash: varchar('email_hash', { length: 64 }).notNull(),
    newsletterId: uuid('newsletter_id')
      .notNull()
      .references(() => newsletters.id, { onDelete: 'cascade' }),
    publisherId: uuid('publisher_id').notNull(), // Denormalized for query perf

    // ESP reference
    espSubscriberId: varchar('esp_subscriber_id', { length: 255 }),
    email: text('email').notNull(), // Encrypted at rest

    // Subscription info
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
    source: varchar('source', { length: 255 }),
    medium: varchar('medium', { length: 100 }),
    campaign: varchar('campaign', { length: 255 }),
    tags: jsonb('tags').$type<string[]>().default([]),
    status: subscriberStatusEnum('status').notNull().default('active'),

    // Tier 1: Engagement metrics
    openRate30d: real('open_rate_30d').notNull().default(0),
    openRate90d: real('open_rate_90d').notNull().default(0),
    clickRate30d: real('click_rate_30d').notNull().default(0),
    clickRate90d: real('click_rate_90d').notNull().default(0),
    lastOpenAt: timestamp('last_open_at', { withTimezone: true }),
    lastClickAt: timestamp('last_click_at', { withTimezone: true }),
    totalOpens: integer('total_opens').notNull().default(0),
    totalClicks: integer('total_clicks').notNull().default(0),
    engagementScore: real('engagement_score').notNull().default(0),

    // Behavioral patterns
    preferredOpenHour: smallint('preferred_open_hour'), // 0-23 UTC
    primaryDevice: varchar('primary_device', { length: 20 }),
    emailClient: varchar('email_client', { length: 50 }),

    // Lifecycle
    lifecycleStage: lifecycleStageEnum('lifecycle_stage').notNull().default('new'),

    // Geo
    country: varchar('country', { length: 2 }),
    region: varchar('region', { length: 100 }),
    timezone: varchar('timezone', { length: 50 }),

    // Tier 2: Survey/profile data
    profileData: jsonb('profile_data').$type<{
      role: string | null;
      experienceLevel: string | null;
      companySize: string | null;
      industry: string | null;
      goals: string[];
      surveyResponses: Array<{
        questionId: string;
        answer: string | string[];
        answeredAt: string;
      }>;
      iabCategories: Record<string, number>;
      topInterests: string[];
    }>(),

    // Tier 3: AI enrichment
    aiEnrichment: jsonb('ai_enrichment').$type<{
      jobTitle: string | null;
      company: string | null;
      companySize: string | null;
      industry: string | null;
      seniorityLevel: string | null;
      linkedinUrl: string | null;
      professionalInterests: string[];
      subscriberSummary: string | null;
      enrichedAt: string | null;
    }>(),

    // Embedding reference
    embeddingId: uuid('embedding_id'),
    embeddingVersion: integer('embedding_version').notNull().default(0),
    embeddingUpdatedAt: timestamp('embedding_updated_at', { withTimezone: true }),
    clusterId: uuid('cluster_id'),

    // Enrichment tier achieved
    enrichmentTier: smallint('enrichment_tier').notNull().default(1),
    profileCompleteness: real('profile_completeness').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('subscribers_email_newsletter_idx').on(
      table.emailHash,
      table.newsletterId,
    ),
    index('subscribers_publisher_idx').on(table.publisherId),
    index('subscribers_cluster_idx').on(table.clusterId),
    index('subscribers_enrichment_tier_idx').on(table.enrichmentTier),
    index('subscribers_engagement_score_idx').on(table.engagementScore),
  ],
);

export const subscribersRelations = relations(subscribers, ({ one }) => ({
  newsletter: one(newsletters, {
    fields: [subscribers.newsletterId],
    references: [newsletters.id],
  }),
}));
