import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { campaigns } from './campaigns';

export const advertisers = pgTable('advertisers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  companyName: varchar('company_name', { length: 200 }).notNull(),
  websiteUrl: text('website_url'),
  logoUrl: text('logo_url'),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),

  // Billing
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  billingEmail: varchar('billing_email', { length: 255 }),

  // Settings
  settings: jsonb('settings').$type<{
    agentEnabled: boolean;
    agentConfig: {
      maxCPM: number;
      maxDailySpend: number;
      autoApproveBelow: number;
      targetCategories: string[];
      excludeCategories: string[];
    };
    notificationPreferences: {
      email: boolean;
      webhook: boolean;
      webhookUrl: string | null;
    };
  }>().default({
    agentEnabled: false,
    agentConfig: {
      maxCPM: 50,
      maxDailySpend: 100,
      autoApproveBelow: 20,
      targetCategories: [],
      excludeCategories: [],
    },
    notificationPreferences: { email: true, webhook: false, webhookUrl: null },
  }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const advertisersRelations = relations(advertisers, ({ many }) => ({
  campaigns: many(campaigns),
}));
