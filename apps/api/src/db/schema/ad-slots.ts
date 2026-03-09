import {
  pgTable,
  uuid,
  real,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { newsletters } from './newsletters';

export const adPlacementTypeEnum = pgEnum('ad_placement_type', [
  'top_banner',
  'mid_content',
  'bottom',
  'dedicated',
  'classified',
]);

export const adSlotFormatEnum = pgEnum('ad_slot_format', [
  'text_link',
  'text_block',
  'image_text',
  'native_mention',
  'sponsored_section',
]);

export const adFrequencyEnum = pgEnum('ad_frequency', [
  'every_issue',
  'weekly',
  'biweekly',
  'monthly',
]);

export const adSlots = pgTable('ad_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  newsletterId: uuid('newsletter_id')
    .notNull()
    .references(() => newsletters.id, { onDelete: 'cascade' }),

  placement: adPlacementTypeEnum('placement').notNull(),
  format: adSlotFormatEnum('format').notNull(),
  maxFrequency: adFrequencyEnum('max_frequency').notNull().default('every_issue'),
  floorCPM: real('floor_cpm').notNull(),
  preferredCategories: jsonb('preferred_categories').$type<string[]>().default([]),
  excludedCategories: jsonb('excluded_categories').$type<string[]>().default([]),
  requiresApproval: boolean('requires_approval').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
