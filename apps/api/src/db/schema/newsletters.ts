import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { publishers } from './publishers';
import { subscribers } from './subscribers';
import { adSlots } from './ad-slots';

export const espProviderEnum = pgEnum('esp_provider', [
  'beehiiv',
  'convertkit',
  'mailchimp',
  'substack',
  'other',
]);

export const newsletterStatusEnum = pgEnum('newsletter_status', [
  'active',
  'paused',
  'pending_verification',
  'suspended',
]);

export const newsletters = pgTable('newsletters', {
  id: uuid('id').primaryKey().defaultRandom(),
  publisherId: uuid('publisher_id')
    .notNull()
    .references(() => publishers.id, { onDelete: 'cascade' }),

  // Basic info
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  websiteUrl: text('website_url'),
  logoUrl: text('logo_url'),

  // Categorization
  primaryCategory: varchar('primary_category', { length: 100 }).notNull(),
  subcategories: jsonb('subcategories').$type<string[]>().default([]),

  // ESP integration
  espProvider: espProviderEnum('esp_provider').notNull(),
  espConfig: jsonb('esp_config').$type<{
    apiKey: string; // Encrypted at rest
    publicationId: string | null;
    listId: string | null;
    webhookSecret: string;
    lastSyncAt: string | null;
    syncStatus: 'active' | 'error' | 'disconnected';
    syncError: string | null;
  }>().notNull(),

  // Metrics (updated via sync)
  subscriberCount: integer('subscriber_count').notNull().default(0),
  activeSubscribers: integer('active_subscribers').notNull().default(0),
  avgOpenRate: real('avg_open_rate').notNull().default(0),
  avgClickRate: real('avg_click_rate').notNull().default(0),
  sendFrequency: varchar('send_frequency', { length: 20 }),
  lastSendAt: timestamp('last_send_at', { withTimezone: true }),

  // Status
  status: newsletterStatusEnum('status').notNull().default('pending_verification'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const newslettersRelations = relations(newsletters, ({ one, many }) => ({
  publisher: one(publishers, {
    fields: [newsletters.publisherId],
    references: [publishers.id],
  }),
  subscribers: many(subscribers),
  adSlots: many(adSlots),
}));
