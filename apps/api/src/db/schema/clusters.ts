import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';

/** Must match EMBEDDING_DIMENSIONS in @adstack/shared */
const EMBEDDING_DIMS = 768;

/**
 * Subscriber clusters derived from K-Means on embeddings.
 * Each cluster has a centroid vector and a human-readable label.
 */
export const subscriberClusters = pgTable('subscriber_clusters', {
  id: uuid('id').primaryKey().defaultRandom(),
  newsletterId: uuid('newsletter_id').notNull(),
  superClusterId: uuid('super_cluster_id'),

  // Centroid vector (768 dimensions)
  centroid: vector('centroid', { dimensions: EMBEDDING_DIMS }).notNull(),

  // LLM-generated label
  label: text('label').notNull(),
  description: text('description'),

  // Cluster metadata
  subscriberCount: integer('subscriber_count').notNull().default(0),
  avgEngagementScore: real('avg_engagement_score').notNull().default(0),
  topInterests: jsonb('top_interests').$type<string[]>().default([]),
  topRoles: jsonb('top_roles').$type<string[]>().default([]),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
