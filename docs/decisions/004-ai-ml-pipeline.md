# ADR-004: AI/ML Embedding Pipeline

**Status:** Accepted
**Date:** 2026-03-08
**Decision Makers:** Engineering Team

---

## Context

AdStack's core value proposition is **precision ad matching** — connecting advertiser campaigns with the most relevant newsletter audiences. Traditional newsletter ad marketplaces rely on coarse category matching (e.g., "tech newsletters" → "tech advertisers"). This fails for nuanced audiences:

- A newsletter about "AI for healthcare executives" is not the same as "AI for developers."
- An advertiser targeting "B2B SaaS founders with 10-50 employees" needs granularity beyond "business newsletter."

To solve this, subscribers need a **dense vector representation** that captures their interests, behavior, and professional profile — enabling **cosine similarity matching** between advertiser audience descriptions and newsletter subscriber clusters.

Key constraints:

1. Subscriber data is private — advertisers must never see individual subscriber profiles.
2. Matching must work at the **cluster level**, not individual level (k-anonymity).
3. The system must handle hundreds of thousands of subscribers across many newsletters.
4. The embedding pipeline must be cost-effective — OpenAI API calls are per-token.
5. The vector store must integrate cleanly with the existing PostgreSQL database.

---

## Decision

**768-dimensional subscriber embeddings via OpenAI text-embedding-3-small, stored in PostgreSQL with pgvector, clustered via K-means, matched via cosine similarity with a k-anonymity threshold of 50.**

---

## Details

### Three-Tier Enrichment Model

Subscriber data is enriched progressively through three tiers, each adding signal density to the embedding:

| Tier | Source | Data | Consent Required |
|------|--------|------|------------------|
| **T1 — Behavioral** | ESP sync (automatic) | Open rates, click rates, engagement score, preferred open hour, device, email client, lifecycle stage, geo | Implicit (standard analytics) |
| **T2 — Profile** | Subscriber surveys, preference centers | Role, experience level, company size, industry, goals, IAB categories, top interests | Explicit (survey participation) |
| **T3 — AI Enrichment** | Clearbit/Apollo-style APIs, LLM inference | Job title, company, seniority, professional interests, subscriber summary | Explicit (enrichment consent) |

The `enrichmentTier` column on the subscribers table tracks the highest tier achieved (1, 2, or 3). The `profileCompleteness` score (0.0–1.0) measures data density within the achieved tier.

**Why progressive tiers:** Not all subscribers will complete surveys or consent to enrichment. T1 data is available for every subscriber (ESP sync provides engagement metrics). T2 and T3 add progressively richer signal for subscribers who opt in. The embedding quality improves with tier — but T1-only embeddings still provide meaningful behavioral clustering.

### Embedding Generation

**Model:** OpenAI `text-embedding-3-small` (768 dimensions)

The embedding input is a structured text description concatenated from all available tier data:

```
Newsletter: {newsletter_name} ({primary_category})
Engagement: {engagement_score} score, {open_rate_30d} open rate, {lifecycle_stage} stage
Device: {primary_device}, {email_client}
Geo: {country}, {region}
[T2] Role: {role}, Industry: {industry}, Experience: {experience_level}
[T2] Interests: {top_interests}
[T2] Goals: {goals}
[T3] Title: {job_title} at {company} ({company_size})
[T3] Seniority: {seniority_level}
[T3] Professional interests: {professional_interests}
```

Lines prefixed with `[T2]` or `[T3]` are only included if the subscriber has achieved that enrichment tier.

**Why text-embedding-3-small:**

| Model | Dimensions | Cost per 1M tokens | Quality |
|-------|-----------|---------------------|---------|
| text-embedding-3-small | 768 (configurable) | $0.02 | Good for clustering/matching |
| text-embedding-3-large | 3072 (configurable) | $0.13 | Highest quality, 6.5x cost |
| text-embedding-ada-002 | 1536 (fixed) | $0.10 | Legacy, lower quality per $ |

768 dimensions at $0.02/M tokens is the sweet spot — sufficient dimensionality for nuanced audience clustering at the lowest cost. The `text-embedding-3-small` model supports native dimension reduction, so we use 768 instead of the full 1536.

### Vector Storage: pgvector

Embeddings are stored in PostgreSQL using the **pgvector** extension (v0.8.1), installed via the `pgvector/pgvector:pg16` Docker image.

**Schema (`subscriber_embeddings` table):**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `subscriber_id` | UUID | FK to subscribers (unique) |
| `newsletter_id` | UUID | Denormalized for partition-friendly queries |
| `embedding` | vector(768) | The 768-dimensional embedding |
| `text_description` | text | The input text (for debugging and re-embedding) |
| `version` | integer | Embedding version (for re-embedding campaigns) |
| `model_id` | text | Model identifier (default: `text-embedding-3-small`) |

**Indexing:** HNSW (Hierarchical Navigable Small World) index on the embedding column for approximate nearest neighbor (ANN) search. HNSW provides sub-millisecond query times with >95% recall at scale.

```sql
CREATE INDEX ON subscriber_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Clustering: K-Means per Newsletter

Subscribers within each newsletter are clustered using K-means on their embedding vectors:

1. **Run K-means** on all embeddings for a newsletter (k is chosen dynamically based on subscriber count, typically `sqrt(n/2)` with a minimum of 3 and maximum of 50).
2. **Generate centroid vectors** for each cluster (stored in `subscriber_clusters.centroid`).
3. **Label clusters** using an LLM — pass the top 10 subscribers nearest each centroid to an LLM and ask for a human-readable label (e.g., "Senior DevOps Engineers interested in cloud infrastructure").
4. **Store metadata** — subscriber count, average engagement score, top interests, top roles.
5. **Assign subscribers** — each subscriber gets a `cluster_id` FK pointing to their cluster.

**Super-clusters** (optional): Clusters across newsletters can be grouped into super-clusters via `super_cluster_id` for cross-newsletter audience comparison.

**Re-clustering frequency:** Nightly batch job or triggered when >10% of a newsletter's subscribers have updated embeddings.

### Matching: Cosine Similarity

When an advertiser creates a campaign, they provide an `audienceDescription` (natural language, e.g., "B2B SaaS founders scaling from seed to Series A"):

1. **Embed the audience description** using the same model (`text-embedding-3-small`, 768 dims).
2. **Store as `audience_embedding_id`** on the campaign targeting JSONB.
3. **Query pgvector** for the most similar cluster centroids across all newsletters:
   ```sql
   SELECT c.*, 1 - (c.centroid <=> :audience_embedding) AS similarity
   FROM subscriber_clusters c
   WHERE c.subscriber_count >= 50  -- k-anonymity threshold
   ORDER BY c.centroid <=> :audience_embedding
   LIMIT :max_results;
   ```
4. **Apply filters** — category, geo, minimum engagement score, minimum subscriber count, excluded newsletters.
5. **Return ranked matches** with similarity scores, audience profiles, available ad slots, and estimated reach/CPM.

The `<=>` operator computes cosine distance; `1 - distance = similarity`.

### Privacy: k-Anonymity

A strict **k-anonymity threshold of 50** is enforced:

- Clusters with fewer than 50 subscribers are never exposed to advertisers.
- Matching queries filter out clusters below the threshold.
- Individual subscriber data (email, profile, engagement) is never returned in matching results.
- Advertisers see only: cluster label, size, average engagement, top interests/roles, and similarity score.

The threshold is defined as `K_ANONYMITY_THRESHOLD = 50` in `@adstack/shared` constants.

### Consent Tracking

An append-only `consent_log` table records every consent action:

| Column | Purpose |
|--------|---------|
| `subscriber_id` | Who consented |
| `action` | `grant` or `revoke` |
| `tier` | Which enrichment tier (1, 2, or 3) |
| `ip` | IP address at time of consent |
| `consent_version` | Version of the consent text shown |
| `consent_text` | Full text of what was consented to |

This table is **append-only** — no UPDATE or DELETE operations. Revocation is recorded as a new `revoke` row, not a deletion of the `grant` row. This provides a complete audit trail for GDPR compliance.

---

## Alternatives Considered

### Dedicated Vector Database (Pinecone, Weaviate, Qdrant)

| Aspect | Assessment |
|--------|------------|
| Approach | Store embeddings in a purpose-built vector database separate from PostgreSQL |
| Pros | Optimized for vector operations; managed scaling; advanced filtering; built-in metadata handling; higher QPS for vector-only workloads |
| Cons | Additional infrastructure to manage; data synchronization between Postgres and vector DB; added latency for joins (subscriber data in Postgres, embeddings in vector DB); cost ($70+/month for managed services); operational complexity |
| Verdict | Rejected for MVP — pgvector handles millions of vectors with HNSW indexing. The data model requires joins between embeddings, subscribers, newsletters, and clusters — keeping everything in one database eliminates synchronization complexity. If pgvector becomes a bottleneck at scale, migration to a dedicated vector DB is straightforward (embeddings are independently queryable). |

### Custom Embedding Model (Fine-Tuned)

| Aspect | Assessment |
|--------|------------|
| Approach | Fine-tune a custom embedding model on newsletter subscriber data |
| Pros | Potentially higher quality embeddings tuned to our domain; lower per-inference cost once trained; no external API dependency |
| Cons | Requires significant labeled training data (which we don't have at launch); GPU training infrastructure; model hosting costs; ongoing maintenance; months of ML engineering effort |
| Verdict | Deferred — OpenAI's general-purpose embeddings are sufficient for launch. Custom embeddings can be explored once we have enough labeled data (successful matches as ground truth) to train a domain-specific model. |

### Binary/Sparse Feature Vectors

| Aspect | Assessment |
|--------|------------|
| Approach | Represent subscribers as sparse binary vectors (e.g., one-hot encoded interests, categories) |
| Pros | Simple to implement; no ML model dependency; exact matching; interpretable features |
| Cons | Cannot capture semantic similarity (e.g., "machine learning" and "deep learning" are unrelated in binary representation); dimensionality grows with vocabulary; no nuanced audience matching; essentially a category filter with extra steps |
| Verdict | Rejected — binary features reduce matching to category intersection, which is what existing ad marketplaces already do poorly. Dense embeddings capture semantic meaning, which is the core product differentiation. |

### Embedding at Query Time Only (No Storage)

| Aspect | Assessment |
|--------|------------|
| Approach | Embed subscriber descriptions on-the-fly for each matching query |
| Pros | No storage overhead; always uses latest data |
| Cons | Extremely expensive — embedding 100K subscribers per query at $0.02/M tokens; latency measured in minutes, not milliseconds; rate-limited by OpenAI API |
| Verdict | Rejected — embeddings must be pre-computed and stored. Re-embedding is triggered by data changes, not queries. |

---

## Consequences

### Positive

- **Semantic matching** — advertisers describe their audience in natural language and get semantically similar newsletter clusters, not just category filters.
- **Single database** — no synchronization between Postgres and a separate vector store. Joins between embeddings, subscribers, and business data are standard SQL.
- **Progressive quality** — embedding quality improves as subscribers move from T1 to T3 enrichment. The system degrades gracefully with T1-only data.
- **Privacy by design** — k-anonymity threshold, cluster-level matching, and append-only consent logging are baked into the architecture.
- **Cost-effective** — text-embedding-3-small at $0.02/M tokens means embedding 100K subscribers costs ~$2. Re-embedding is infrequent (triggered by data changes).

### Negative

- **OpenAI dependency** — embedding generation depends on an external API. Mitigation: stored embeddings mean the API is only called for new/updated subscribers, not at query time. If OpenAI is down, matching still works on existing embeddings.
- **Clustering lag** — nightly re-clustering means new subscribers don't appear in clusters immediately. Mitigation: new subscribers can be assigned to the nearest existing cluster via a lightweight online assignment.
- **768-dimensional storage cost** — each embedding is ~6 KB (768 floats * 8 bytes). 1M subscribers = ~6 GB of embedding data. This is manageable but non-trivial.

### Risks

- **Embedding model changes** — if OpenAI deprecates `text-embedding-3-small`, all embeddings need re-generation. The `model_id` and `version` columns enable tracking which model produced each embedding.
- **pgvector HNSW memory pressure** — HNSW indexes are memory-resident for best performance. At 1M+ embeddings, the index may exceed available RAM. Mitigation: tune `m` and `ef_construction` parameters; consider IVFFlat for lower memory usage at the cost of recall.
- **Cluster quality** — K-means assumes spherical clusters in embedding space. If subscriber distributions are non-spherical, clustering quality degrades. Monitoring: track intra-cluster variance and silhouette scores.
- **Stale embeddings** — subscriber behavior changes over time. Embeddings must be refreshed periodically. Strategy: re-embed subscribers whose engagement metrics have changed significantly (>20% delta) since last embedding.

---

## References

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [pgvector: Open-source vector similarity search for Postgres](https://github.com/pgvector/pgvector)
- [HNSW Algorithm Explained](https://www.pinecone.io/learn/series/faiss/hnsw/)
- [k-Anonymity (Wikipedia)](https://en.wikipedia.org/wiki/K-anonymity)
- Source: `apps/api/src/db/schema/embeddings.ts`, `apps/api/src/db/schema/clusters.ts`, `apps/api/src/db/schema/subscribers.ts`, `apps/api/src/db/schema/consent-log.ts`, `packages/shared/src/constants/index.ts`
