import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { newsletters } from './newsletters';

export const publisherPlanEnum = pgEnum('publisher_plan', ['free', 'pro', 'enterprise']);
export const agentModeEnum = pgEnum('agent_mode', ['manual', 'semi_auto', 'full_auto']);

export const publishers = pgTable('publishers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  companyName: varchar('company_name', { length: 200 }),
  avatarUrl: text('avatar_url'),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),

  // Subscription
  plan: publisherPlanEnum('plan').notNull().default('free'),
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),

  // Stripe
  stripeConnectAccountId: varchar('stripe_connect_account_id', { length: 255 }),

  // Settings
  settings: jsonb('settings').$type<{
    autoApproveAds: boolean;
    autoApproveCategories: string[];
    agentMode: 'manual' | 'semi_auto' | 'full_auto';
    notificationPreferences: {
      email: boolean;
      webhook: boolean;
      webhookUrl: string | null;
    };
  }>().default({
    autoApproveAds: false,
    autoApproveCategories: [],
    agentMode: 'manual',
    notificationPreferences: { email: true, webhook: false, webhookUrl: null },
  }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const publishersRelations = relations(publishers, ({ many }) => ({
  newsletters: many(newsletters),
}));
