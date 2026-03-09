# ADR-005: Data Model & Schema Design

**Status:** Accepted
**Date:** 2026-03-08
**Decision Makers:** Engineering Team

---

## Context

AdStack is a two-sided marketplace with a complex domain that spans the full lifecycle of newsletter ad placement — from publisher onboarding and subscriber enrichment, through campaign creation and AI-powered matching, to negotiation, placement, delivery verification, and financial settlement.

The data model must:

1. Support two distinct user types (publishers, advertisers) with fundamentally different data shapes.
2. Represent newsletter subscribers with rich, evolving profile data across three enrichment tiers.
3. Store 768-dimensional embedding vectors alongside relational data.
4. Track the full ad placement lifecycle (scheduled → placed → delivered → verified → settled).
5. Record financial transactions with Stripe references for audit.
6. Maintain GDPR-compliant consent records.
7. Handle evolving/flexible data (settings, profiles, targeting criteria) without constant schema migrations.
8. Support efficient queries for the matching engine (vector similarity + relational filters).

---

## Decision

**13-table relational schema in PostgreSQL 16 with pgvector, using UUIDs for all primary keys, JSONB for flexible/evolving data, denormalized metrics for query performance, and an append-only consent log for GDPR compliance.**

---

## Details

### Table Overview

| # | Table | Purpose | Key Relations |
|---|-------|---------|---------------|
| 1 | `publishers` | Newsletter owners/sellers | → newsletters |
| 2 | `newsletters` | Individual newsletter properties | → publisher, → subscribers, → ad_slots |
| 3 | `subscribers` | Newsletter subscriber profiles + metrics | → newsletter |
| 4 | `subscriber_embeddings` | 768-dim vector embeddings | → subscriber (1:1) |
| 5 | `subscriber_clusters` | K-means cluster centroids + metadata | → newsletter |
| 6 | `ad_slots` | Available ad inventory per newsletter | → newsletter |
| 7 | `advertisers` | Campaign buyers | → campaigns |
| 8 | `campaigns` | Ad campaign definitions + targeting | → advertiser, → creatives, → placements |
| 9 | `creatives` | Ad creative content + variants | → campaign |
| 10 | `negotiations` | Agent-to-agent negotiation records | → campaign, → newsletter |
| 11 | `ad_placements` | Placed ads (settlement record) | → campaign, → newsletter |
| 12 | `transactions` | Financial transaction ledger | references placements |
| 13 | `consent_log` | Append-only GDPR consent audit trail | → subscriber |

### Primary Keys: UUIDs

All tables use UUID primary keys with `defaultRandom()`:

```typescript
id: uuid('id').primaryKey().defaultRandom()
```

**Why UUIDs over auto-increment integers:**

| Concern | UUID | Auto-Increment |
|---------|------|----------------|
| Enumeration attacks | Cannot guess other IDs | Trivial (id+1) |
| Distributed generation | Any node can generate | Requires coordination |
| URL exposure | Safe to expose in URLs | Leaks row count/creation order |
| Merge/replication | No conflicts | ID collisions across shards |
| Performance | Slightly larger (16 bytes vs 4-8) | Smaller, better B-tree locality |

The performance cost of UUIDs is negligible at our scale. The security and distribution benefits are significant for a marketplace where IDs appear in URLs and API responses.

### JSONB for Flexible Data

Six tables use JSONB columns for data that is evolving, nested, or varies per instance:

| Table | JSONB Column | Purpose | Why Not Separate Tables |
|-------|-------------|---------|-------------------------|
| `publishers` | `settings` | Auto-approve rules, agent mode, notification prefs | Settings are read/written as a unit; no cross-publisher queries on individual settings |
| `newsletters` | `subcategories`, `esp_config` | Variable-length category lists; ESP-specific config that differs per provider | Subcategories are a simple array; ESP config structure varies by provider |
| `subscribers` | `tags`, `profile_data`, `ai_enrichment` | Variable-length tags; nested survey responses; enrichment data that arrives incrementally | Deep nesting (survey responses with arrays); data shape evolves as enrichment providers change |
| `advertisers` | `settings` | Agent config, spend limits, notification prefs | Same rationale as publisher settings |
| `campaigns` | `targeting`, `preferred_days` | Audience targeting criteria (variable fields); day-of-week preferences | Targeting criteria will evolve frequently; separate table would require migrations for each new filter |
| `negotiations` | `offers`, `agreed_terms` | Append-only negotiation history; final agreement record | Offers are an ordered log with variable rounds; no need to query individual offers across negotiations |
| `creatives` | `variants` | Per-cluster ad variants | Variable number of variants per creative |
| `ad_placements` | `target_cluster_ids`, `clicks_by_cluster` | Cluster targeting; per-cluster click analytics | Simple arrays/maps; no cross-placement aggregation needed |

**JSONB trade-off:** JSONB columns sacrifice referential integrity and query optimization for schema flexibility. Each JSONB column has a TypeScript `$type<>()` annotation that provides compile-time type safety, partially compensating for the lack of database-level constraints.

### Denormalized Metrics

Several columns are intentionally denormalized for query performance:

| Table | Denormalized Column | Source | Update Mechanism |
|-------|-------------------|--------|------------------|
| `subscribers` | `publisherId` | `newsletters.publisherId` | Set on creation |
| `newsletters` | `subscriberCount`, `activeSubscribers` | COUNT on subscribers | ESP sync job |
| `newsletters` | `avgOpenRate`, `avgClickRate` | AVG on subscribers | ESP sync job |
| `subscribers` | `openRate30d/90d`, `clickRate30d/90d` | ESP event data | ESP sync job |
| `subscribers` | `engagementScore` | Computed from open/click rates | Scoring pipeline |
| `campaigns` | `totalImpressions`, `totalClicks`, `avgCTR` | SUM on ad_placements | Delivery verification job |
| `campaigns` | `spentToDate`, `placementCount` | SUM/COUNT on ad_placements | Settlement job |

**Why denormalize:** Dashboard queries show subscriber counts, engagement metrics, and campaign performance on list pages. Computing these from raw data on every request would require expensive joins and aggregations. The denormalized columns are updated by background sync/processing jobs.

### Subscriber Table Design

The `subscribers` table is the largest and most complex, housing data across all three enrichment tiers:

**Tier 1 (Behavioral — always available):**
- Engagement metrics: `open_rate_30d`, `open_rate_90d`, `click_rate_30d`, `click_rate_90d`
- Activity: `last_open_at`, `last_click_at`, `total_opens`, `total_clicks`
- Computed: `engagement_score` (0.0–1.0)
- Behavioral: `preferred_open_hour`, `primary_device`, `email_client`
- Lifecycle: `lifecycle_stage` (new → active → at_risk → dormant → churned)
- Geo: `country`, `region`, `timezone`

**Tier 2 (Profile — opt-in via surveys):**
- JSONB `profile_data`: role, experience level, company size, industry, goals, survey responses, IAB categories, top interests

**Tier 3 (AI Enrichment — explicit consent):**
- JSONB `ai_enrichment`: job title, company, company size, industry, seniority level, LinkedIn URL, professional interests, subscriber summary

**Privacy:** Email addresses are stored encrypted at rest (`email` column with application-level encryption). Email hashes (`email_hash`, SHA-256) are used for deduplication across newsletters. A unique index on `(email_hash, newsletter_id)` prevents duplicate subscriptions per newsletter.

### Ad Placement Lifecycle

The `ad_placements` table tracks placements through a defined state machine:

```
scheduled → placed → delivered → verified → settled
                                    ↓
                                 disputed
```

| Status | Meaning | Trigger |
|--------|---------|---------|
| `scheduled` | Placement booked for a future date | Negotiation accepted or direct booking |
| `placed` | Creative inserted into newsletter issue | Publisher confirms placement |
| `delivered` | Newsletter sent to subscribers | ESP webhook confirms delivery |
| `verified` | Impressions/clicks verified | Verification job confirms metrics |
| `disputed` | Publisher or advertiser disputes metrics | Manual dispute initiation |
| `settled` | Payment processed to publisher | Stripe transfer completed |

Settlement columns on the placement (`publisher_payout`, `platform_fee`, `stripe_transfer_id`, `settlement_status`) make it the single record of financial truth for each ad placement.

### Negotiation Model

Negotiations use an **append-only offer log** stored in JSONB:

```json
{
  "offers": [
    { "round": 1, "from": "buyer", "offeredCPM": 25.00, ... },
    { "round": 2, "from": "publisher", "offeredCPM": 35.00, ... },
    { "round": 3, "from": "buyer", "offeredCPM": 30.00, ... }
  ],
  "agreedTerms": { "cpm": 30.00, "slot": "top_banner", ... }
}
```

Maximum negotiation rounds are bounded at 3 (`MAX_NEGOTIATION_ROUNDS` constant). Negotiations expire after a configurable deadline (`expires_at`).

### Transaction Ledger

The `transactions` table is a financial ledger tracking all money movement:

| Type | Description |
|------|-------------|
| `ad_placement` | Advertiser pays for a placed ad |
| `enrichment_fee` | Subscriber enrichment costs (T3 AI enrichment) |
| `subscription` | Publisher plan subscription payment |
| `refund` | Refund for disputed/cancelled placement |

Each transaction records: `gross_amount`, `platform_fee` (percentage based on publisher plan), `stripe_fee`, and `net_amount`. Platform fee rates are defined in `@adstack/shared`:

- Free plan: 15%
- Pro plan: 12%
- Enterprise plan: 10%

### Indexes

Strategic indexes for the most common query patterns:

| Table | Index | Purpose |
|-------|-------|---------|
| `subscribers` | `(email_hash, newsletter_id)` UNIQUE | Deduplication |
| `subscribers` | `(publisher_id)` | Publisher dashboard queries |
| `subscribers` | `(cluster_id)` | Cluster membership lookups |
| `subscribers` | `(enrichment_tier)` | Filter by enrichment level |
| `subscribers` | `(engagement_score)` | Sort/filter by engagement |
| `subscriber_embeddings` | `(newsletter_id)` | Per-newsletter embedding queries |
| `subscriber_embeddings` | HNSW on `embedding` | Vector similarity search |
| `consent_log` | `(subscriber_id)` | Consent history lookups |

### Enum Strategy

PostgreSQL enums (`pgEnum`) are used for columns with fixed, rarely-changing value sets:

| Enum | Values |
|------|--------|
| `publisher_plan` | free, pro, enterprise |
| `agent_mode` | manual, semi_auto, full_auto |
| `esp_provider` | beehiiv, convertkit, mailchimp, substack, other |
| `newsletter_status` | active, paused, pending_verification, suspended |
| `subscriber_status` | active, unsubscribed, bounced, complained |
| `lifecycle_stage` | new, active, at_risk, dormant, churned |
| `campaign_status` | draft, active, paused, completed, cancelled |
| `pricing_model` | cpm, cpc, hybrid |
| `ad_format` | text_link, text_block, image_text, native_mention, sponsored_section |
| `ad_placement_type` | top_banner, mid_content, bottom, dedicated, classified |
| `placement_status` | scheduled, placed, delivered, verified, disputed, settled |
| `negotiation_status` | initiated, counter_offered, accepted, rejected, expired, withdrawn |
| `moderation_status` | pending, approved, rejected |
| `consent_action` | grant, revoke |
| `transaction_type` | ad_placement, enrichment_fee, subscription, refund |
| `transaction_status` | pending, processing, completed, refunded, failed |

**Trade-off:** Postgres enums are type-safe and storage-efficient (4 bytes) but cannot be altered easily (adding values requires `ALTER TYPE ... ADD VALUE`, which cannot run inside a transaction in older Postgres versions). For sets that may grow frequently, JSONB or varchar with application-level validation would be preferable.

### Migration Strategy

Migrations are managed by **Drizzle Kit**:

1. Schema changes are made in `apps/api/src/db/schema/*.ts` files (one file per table).
2. `pnpm db:generate` produces human-readable SQL migration files.
3. `pnpm db:migrate` applies pending migrations.
4. Migration files are committed to version control for auditability.

**Known constraint:** `drizzle-kit` uses CommonJS internally, so schema files must not use `.js` extensions in cross-references within the schema directory, and cannot resolve `@adstack/shared` imports. Constants needed in schema files (like `EMBEDDING_DIMS`) are inlined.

---

## Alternatives Considered

### Single Users Table (Polymorphic)

| Aspect | Assessment |
|--------|------------|
| Approach | One `users` table with a `role` column; role-specific data in JSONB or separate profile tables |
| Pros | Simpler auth queries; one email lookup; standard pattern |
| Cons | Publishers and advertisers have fundamentally different fields (ESP config vs billing, plan tiers vs agent config); JSONB loses type safety; nullable columns proliferate; queries need role-aware WHERE clauses everywhere |
| Verdict | Rejected — the two user types diverge significantly. Separate `publishers` and `advertisers` tables with independent schemas are cleaner and more maintainable. A `users` view or union query can be created if cross-type queries are needed. |

### NoSQL Document Store (MongoDB)

| Aspect | Assessment |
|--------|------------|
| Approach | Store each entity as a JSON document in MongoDB |
| Pros | Schema-flexible; natural for JSONB-heavy data; horizontal scaling |
| Cons | No pgvector equivalent (would need separate vector DB); no ACID transactions for financial settlements; no foreign key enforcement; query language less powerful for complex joins; additional infrastructure |
| Verdict | Rejected — the data model is fundamentally relational (publishers own newsletters, campaigns reference placements, etc.). pgvector requires PostgreSQL. Financial transactions require ACID guarantees. |

### Separate Embedding Database

| Aspect | Assessment |
|--------|------------|
| Approach | Store embeddings in a dedicated system (Pinecone, Qdrant) with foreign keys back to Postgres |
| Pros | Purpose-built for vector operations; managed scaling; optimized ANN search |
| Cons | Data synchronization between two databases; no transactional consistency; added infrastructure; matching queries require cross-database joins |
| Verdict | Rejected for MVP — pgvector with HNSW indexing handles the expected scale (hundreds of thousands of embeddings). Keeping embeddings in PostgreSQL means matching queries can join with subscriber/newsletter/cluster data in a single query. See ADR-004 for detailed vector storage analysis. |

### Event Sourcing for Negotiations/Placements

| Aspect | Assessment |
|--------|------------|
| Approach | Store state changes as immutable events; derive current state from event replay |
| Pros | Complete audit trail; temporal queries; undo capability |
| Cons | Significant implementation complexity; projection management; eventual consistency; overkill for bounded negotiation rounds (max 3) |
| Verdict | Rejected — the JSONB `offers` array in negotiations already provides an append-only event log within a single row. The consent_log table uses true append-only semantics where it matters most (GDPR). Full event sourcing adds complexity without proportional benefit. |

---

## Consequences

### Positive

- **Single database for all data** — relational data, vector embeddings, and JSONB flexibility in one PostgreSQL instance. No cross-database synchronization.
- **Type-safe JSONB** — Drizzle's `$type<>()` annotations provide TypeScript type safety for JSONB columns, catching errors at compile time despite the lack of database-level constraints.
- **GDPR-ready** — append-only consent_log with full audit trail (IP, version, consent text) satisfies regulatory requirements for data processing consent records.
- **Clean lifecycle tracking** — the placement status enum defines an explicit state machine that is easy to reason about and query.
- **Efficient dashboard queries** — denormalized metrics avoid expensive aggregations for common list views.

### Negative

- **Denormalization maintenance** — background jobs must keep denormalized metrics in sync. If a sync job fails, dashboard data becomes stale. Mitigation: last-sync timestamps and monitoring.
- **JSONB schema drift** — JSONB columns can accumulate stale fields as the application evolves. TypeScript types enforce the expected shape at compile time, but old data in the database may not conform. Mitigation: data migrations for significant schema changes.
- **Complex subscriber table** — the subscribers table has 30+ columns spanning all three enrichment tiers. This is a deliberate trade-off: separating tiers into multiple tables would require joins for every subscriber query.
- **Enum rigidity** — PostgreSQL enums cannot be easily removed or renamed (only new values can be added). If a status value needs to be retired, it must be handled in application code.

### Risks

- **Subscriber table growth** — at scale, the subscribers table could contain millions of rows with wide columns (especially JSONB). Mitigation: partition by `newsletter_id` if query performance degrades; archive churned subscribers.
- **JSONB query performance** — complex queries on nested JSONB fields (e.g., filtering by `profile_data.industry`) may require GIN indexes. Monitor query plans as data grows.
- **Drizzle Kit limitations** — drizzle-kit's CJS runtime and inability to resolve workspace imports means schema files must inline shared constants. This creates potential drift if constants change in `@adstack/shared` but not in schema files.

---

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/16/datatype-json.html)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [UUID vs Auto-Increment Primary Keys](https://blog.twitter.com/engineering/en_us/a/2010/announcing-snowflake)
- [GDPR Consent Records Requirements](https://gdpr-info.eu/art-7-gdpr/)
- Source: `apps/api/src/db/schema/` (all files), `packages/shared/src/constants/index.ts`
