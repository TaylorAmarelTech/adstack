import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { campaigns } from './campaigns';

export const adFormatEnum = pgEnum('ad_format', [
  'text_link',
  'text_block',
  'image_text',
  'native_mention',
  'sponsored_section',
]);

export const moderationStatusEnum = pgEnum('moderation_status', [
  'pending',
  'approved',
  'rejected',
]);

export const creatives = pgTable('creatives', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),

  format: adFormatEnum('format').notNull(),
  headline: varchar('headline', { length: 200 }).notNull(),
  body: text('body').notNull(),
  ctaText: varchar('cta_text', { length: 50 }).notNull(),
  ctaUrl: text('cta_url').notNull(),
  imageUrl: text('image_url'),

  // Per-cluster variants
  variants: jsonb('variants').$type<
    Array<{
      id: string;
      clusterMatchDescription: string;
      headline: string;
      body: string;
      ctaText: string;
    }>
  >().default([]),

  // Moderation
  moderationStatus: moderationStatusEnum('moderation_status').notNull().default('pending'),
  moderationNotes: text('moderation_notes'),

  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
