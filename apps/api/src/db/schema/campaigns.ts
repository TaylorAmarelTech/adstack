import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  integer,
  real,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { advertisers } from './advertisers';
import { creatives } from './creatives';
import { adPlacements } from './ad-placements';

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled',
]);

export const pricingModelEnum = pgEnum('pricing_model', ['cpm', 'cpc', 'hybrid']);

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  advertiserId: uuid('advertiser_id')
    .notNull()
    .references(() => advertisers.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 200 }).notNull(),
  status: campaignStatusEnum('status').notNull().default('draft'),

  // Budget
  totalBudget: real('total_budget').notNull(),
  dailyBudgetCap: real('daily_budget_cap').notNull(),
  spentToDate: real('spent_to_date').notNull().default(0),
  pricingModel: pricingModelEnum('pricing_model').notNull(),
  maxCPM: real('max_cpm'),
  maxCPC: real('max_cpc'),

  // Targeting
  targeting: jsonb('targeting').$type<{
    audienceDescription: string;
    audienceEmbeddingId: string | null;
    categories: string[];
    geoTargeting: string[];
    minEngagementScore: number;
    minSubscriberCount: number;
    excludeNewsletters: string[];
    targetClusterIds: string[];
  }>().notNull(),

  // Schedule
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  preferredDays: jsonb('preferred_days').$type<number[]>().default([]),

  // Performance (aggregate)
  totalImpressions: integer('total_impressions').notNull().default(0),
  totalClicks: integer('total_clicks').notNull().default(0),
  avgCTR: real('avg_ctr').notNull().default(0),
  placementCount: integer('placement_count').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  advertiser: one(advertisers, {
    fields: [campaigns.advertiserId],
    references: [advertisers.id],
  }),
  creatives: many(creatives),
  placements: many(adPlacements),
}));
