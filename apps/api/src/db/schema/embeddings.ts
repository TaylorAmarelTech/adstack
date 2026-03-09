import {
  pgTable,
  uuid,
  integer,
  timestamp,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';

/** Must match EMBEDDING_DIMENSIONS in @adstack/shared */
const EMBEDDING_DIMS = 768;

/**
 * Subscriber embeddings stored via pgvector.
 * Each subscriber has a 768-dimensional embedding vector
 * generated from their text description.
 */
export const subscriberEmbeddings = pgTable(
  'subscriber_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriberId: uuid('subscriber_id').notNull().unique(),
    newsletterId: uuid('newsletter_id').notNull(),

    // The embedding vector (768 dimensions)
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMS }).notNull(),

    // The text description that was embedded (for debugging/re-embedding)
    textDescription: text('text_description').notNull(),

    // Versioning
    version: integer('version').notNull().default(1),
    modelId: text('model_id').notNull().default('text-embedding-3-small'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('embeddings_newsletter_idx').on(table.newsletterId),
    // HNSW index for fast vector similarity search
    // This will be created via raw SQL migration since Drizzle
    // doesn't natively support HNSW index creation syntax yet
  ],
);
