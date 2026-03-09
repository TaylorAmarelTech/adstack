import {
  pgTable,
  uuid,
  varchar,
  real,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { campaigns } from './campaigns';
import { newsletters } from './newsletters';

export const placementStatusEnum = pgEnum('placement_status', [
  'scheduled',
  'placed',
  'delivered',
  'verified',
  'disputed',
  'settled',
]);

export const settlementStatusEnum = pgEnum('settlement_status', [
  'pending',
  'processing',
  'completed',
  'disputed',
]);

export const adPlacements = pgTable('ad_placements', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id),
  newsletterId: uuid('newsletter_id')
    .notNull()
    .references(() => newsletters.id),
  adSlotId: uuid('ad_slot_id').notNull(),
  creativeId: uuid('creative_id').notNull(),
  negotiationId: uuid('negotiation_id'),

  // Terms
  agreedCPM: real('agreed_cpm').notNull(),
  agreedCPC: real('agreed_cpc'),
  placementDate: timestamp('placement_date', { withTimezone: true }).notNull(),

  // Cluster targeting
  targetClusterIds: jsonb('target_cluster_ids').$type<string[]>().default([]),

  // Status
  status: placementStatusEnum('status').notNull().default('scheduled'),

  // Performance
  impressions: integer('impressions').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  uniqueClicks: integer('unique_clicks').notNull().default(0),
  ctr: real('ctr').notNull().default(0),
  cost: real('cost').notNull().default(0),
  clicksByCluster: jsonb('clicks_by_cluster').$type<Record<string, number>>().default({}),

  // Settlement
  publisherPayout: real('publisher_payout'),
  platformFee: real('platform_fee'),
  stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
  settlementStatus: settlementStatusEnum('settlement_status').default('pending'),
  settledAt: timestamp('settled_at', { withTimezone: true }),

  placedAt: timestamp('placed_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adPlacementsRelations = relations(adPlacements, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [adPlacements.campaignId],
    references: [campaigns.id],
  }),
  newsletter: one(newsletters, {
    fields: [adPlacements.newsletterId],
    references: [newsletters.id],
  }),
}));
