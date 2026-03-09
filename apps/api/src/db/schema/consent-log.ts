import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const consentActionEnum = pgEnum('consent_action', ['grant', 'revoke']);

/**
 * Append-only consent log for GDPR compliance.
 * Every consent action is logged with full context.
 * This table should NEVER have UPDATE or DELETE operations.
 */
export const consentLog = pgTable(
  'consent_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriberId: uuid('subscriber_id').notNull(),

    action: consentActionEnum('action').notNull(),
    tier: smallint('tier').notNull(), // 1, 2, or 3
    ip: varchar('ip', { length: 45 }).notNull(), // IPv6 max length
    consentVersion: varchar('consent_version', { length: 20 }).notNull(),
    consentText: text('consent_text').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('consent_log_subscriber_idx').on(table.subscriberId),
  ],
);
