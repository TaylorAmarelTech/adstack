import {
  pgTable,
  uuid,
  smallint,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { campaigns } from './campaigns';
import { newsletters } from './newsletters';

export const negotiationStatusEnum = pgEnum('negotiation_status', [
  'initiated',
  'counter_offered',
  'accepted',
  'rejected',
  'expired',
  'withdrawn',
]);

export const negotiations = pgTable('negotiations', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id),
  newsletterId: uuid('newsletter_id')
    .notNull()
    .references(() => newsletters.id),
  adSlotId: uuid('ad_slot_id').notNull(),

  // Parties
  buyerAgentId: uuid('buyer_agent_id').notNull(),
  publisherAgentId: uuid('publisher_agent_id').notNull(),

  // State
  status: negotiationStatusEnum('status').notNull().default('initiated'),
  round: smallint('round').notNull().default(1),

  // Offers
  offers: jsonb('offers').$type<
    Array<{
      round: number;
      from: 'buyer' | 'publisher';
      offeredCPM: number;
      requestedSlot: string;
      requestedFrequency: string;
      exclusivityRequested: boolean;
      notes: string | null;
      timestamp: string;
    }>
  >().default([]),

  // Final terms (if accepted)
  agreedTerms: jsonb('agreed_terms').$type<{
    cpm: number;
    slot: string;
    frequency: string;
    exclusivity: boolean;
    startDate: string;
    endDate: string;
  }>(),

  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
