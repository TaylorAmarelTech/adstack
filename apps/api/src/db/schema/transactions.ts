import {
  pgTable,
  uuid,
  varchar,
  real,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const transactionTypeEnum = pgEnum('transaction_type', [
  'ad_placement',
  'enrichment_fee',
  'subscription',
  'refund',
]);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'processing',
  'completed',
  'refunded',
  'failed',
]);

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: transactionTypeEnum('type').notNull(),

  // Parties
  payerId: uuid('payer_id').notNull(),
  payeeId: uuid('payee_id'),

  // Amounts
  grossAmount: real('gross_amount').notNull(),
  platformFee: real('platform_fee').notNull(),
  stripeFee: real('stripe_fee').notNull().default(0),
  netAmount: real('net_amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),

  // Stripe references
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),

  // Reference
  referenceType: varchar('reference_type', { length: 50 }).notNull(),
  referenceId: uuid('reference_id').notNull(),

  status: transactionStatusEnum('status').notNull().default('pending'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
