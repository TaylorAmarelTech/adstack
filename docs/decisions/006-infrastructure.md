# ADR-006: Infrastructure & Deployment

**Status:** Accepted
**Date:** 2026-03-08
**Decision Makers:** Engineering Team

---

## Context

AdStack is an MVP-stage marketplace built by a solo founder. The infrastructure must:

1. Enable fast local development with minimal setup.
2. Provide production-grade foundations that don't require a rewrite when going live.
3. Keep operational costs near zero during development and early traction.
4. Support the specific technology requirements: PostgreSQL 16 with pgvector, Redis, Node.js 22.
5. Avoid premature infrastructure complexity that consumes engineering time without user-facing value.

The guiding principle: **infrastructure should be invisible during MVP — it works, it's reliable, and it doesn't demand attention.**

---

## Decision

**Docker Compose for local development, pnpm workspaces for monorepo management, with a deployment target of PaaS providers (Railway, Render, or Fly.io) for initial production.**

---

## Details

### Local Development: Docker Compose

Two services are containerized for local development:

#### PostgreSQL 16 + pgvector

```yaml
postgres:
  image: pgvector/pgvector:pg16
  ports: "5433:5432"    # 5433 to avoid conflict with local Postgres
  environment:
    POSTGRES_USER: adstack
    POSTGRES_PASSWORD: adstack_dev
    POSTGRES_DB: adstack_dev
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./infrastructure/sql/init.sql:/docker-entrypoint-initdb.d/01-init.sql
```

The `pgvector/pgvector:pg16` image includes pgvector pre-compiled. The `init.sql` script runs `CREATE EXTENSION IF NOT EXISTS vector` on first container start, ensuring pgvector is available immediately.

**Port 5433:** The dev machine has an existing PostgreSQL installation on port 5432, so the container maps to 5433. The `DATABASE_URL` env var defaults to `postgresql://adstack:adstack_dev@localhost:5433/adstack_dev`.

#### Redis 7 Alpine

```yaml
redis:
  image: redis:7-alpine
  ports: "6379:6379"
  command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
```

Redis is configured with:
- **AOF persistence** (`appendonly yes`) — data survives container restarts.
- **128 MB memory cap** — prevents Redis from consuming excessive memory on the dev machine.
- **LRU eviction** (`allkeys-lru`) — least recently used keys are evicted when memory is full.

**Redis use cases:** Rate limiting (via `@fastify/rate-limit`), caching (newsletter metadata, matching results), and future job queue (Bull/BullMQ for background embedding generation).

#### What Is NOT Containerized

The Node.js application (API + frontend) runs natively on the host machine via `pnpm dev`. Reasons:

- **Faster iteration** — no Docker build step on code changes; tsx provides instant TypeScript execution.
- **Better debugging** — native Node.js debugging (VS Code attach, `--inspect`) works without Docker network configuration.
- **Simpler HMR** — Vite's HMR works over localhost without Docker port/volume complexity.
- **Monorepo symlinks** — pnpm's symlinked `node_modules` and workspace dependencies are complex to mount correctly in Docker.

### Health Checks

Both Docker services include health checks:

- **Postgres:** `pg_isready -U adstack -d adstack_dev` every 5 seconds, 5 retries.
- **Redis:** `redis-cli ping` every 5 seconds, 5 retries.

The API server verifies database connectivity on startup by executing `SELECT NOW()` and logging the PostgreSQL version.

### Monorepo: pnpm Workspaces + Turborepo

The monorepo structure:

```
newsletter_platform/
  apps/
    api/       — @adstack/api (Fastify backend)
    web/       — @adstack/web (Vite React frontend)
  packages/
    shared/    — @adstack/shared (Zod schemas, types, constants)
  infrastructure/
    sql/       — Database init scripts
  docs/
    decisions/ — ADRs
```

**pnpm workspaces** manage cross-package dependencies. `@adstack/api` and `@adstack/web` both depend on `@adstack/shared` via workspace protocol (`"@adstack/shared": "workspace:*"`).

**Turborepo** orchestrates build/dev/lint/test tasks with:
- Parallel execution across packages.
- Dependency-aware task ordering (shared builds before api/web).
- Local build caching (skips unchanged packages).

### Environment Configuration

Environment variables are validated at startup using Zod in `apps/api/src/config/env.ts`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3001` | API server port |
| `LOG_LEVEL` | `info` | Pino log level |
| `APP_URL` | `http://localhost:5173` | Frontend URL (for CORS) |
| `API_URL` | `http://localhost:3001` | API URL |
| `DATABASE_URL` | `postgresql://...localhost:5433/adstack_dev` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `SESSION_SECRET` | dev default (32+ chars) | JWT signing secret |
| `COOKIE_DOMAIN` | `localhost` | Auth cookie domain |
| `ENCRYPTION_KEY` | dev default (32+ chars) | Data encryption key |
| `STRIPE_SECRET_KEY` | optional | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | optional | Stripe webhook verification |
| `OPENAI_API_KEY` | optional | OpenAI embedding API |
| `ANTHROPIC_API_KEY` | optional | Anthropic LLM API |

In development, `dotenv` loads `.env` files. In production, environment variables are injected by the hosting platform. If required variables are missing, the process exits immediately with a descriptive error.

### Structured Logging: Pino

Fastify uses Pino for structured JSON logging by default:

- **Development:** Human-readable output via `pino-pretty` (configured by log level).
- **Production:** JSON-structured logs for ingestion by log aggregators (Datadog, Grafana Loki, CloudWatch).
- **Request logging:** Fastify automatically logs request/response with timing.

### Database Connection Pooling

The API uses `pg.Pool` with conservative defaults:

| Setting | Value | Rationale |
|---------|-------|-----------|
| `max` | 10 | Sufficient for MVP; prevents exhausting Postgres `max_connections` |
| `idleTimeoutMillis` | 30,000 | Release idle connections after 30 seconds |
| `connectionTimeoutMillis` | 5,000 | Fail fast if Postgres is unreachable |

The pool is registered as a Fastify plugin (`dbPlugin`) with a graceful shutdown hook that calls `pool.end()` on `onClose`.

### Production Deployment Target (Future)

The MVP targets PaaS deployment for minimal operational overhead:

#### Application Hosting

| Provider | Pros | Cons | Estimated Cost |
|----------|------|------|----------------|
| **Railway** | Git-push deploy; built-in Postgres + Redis; monorepo support; generous free tier | Smaller community than alternatives | $5-20/month |
| **Render** | Simple Docker/Node.js deploy; managed Postgres; auto-scaling; free tier | Free tier databases expire after 90 days | $7-25/month |
| **Fly.io** | Edge deployment; Postgres (LiteFS or managed); WebSocket support; Docker-based | More complex config; smaller managed Postgres offering | $5-15/month |

**Leaning toward Railway** for initial deployment — it supports monorepo build paths, has integrated PostgreSQL and Redis, and requires near-zero configuration.

#### Managed PostgreSQL

| Provider | pgvector Support | Pros | Estimated Cost |
|----------|-----------------|------|----------------|
| **Supabase** | Native | Built-in pgvector; connection pooling (PgBouncer); dashboard; generous free tier | Free → $25/month |
| **Neon** | Native | Serverless scaling; branching (dev/staging databases); auto-suspend | Free → $19/month |
| **Railway Postgres** | Via extension | Integrated with app hosting; simple setup | Included in hosting plan |
| **AWS RDS** | Via extension | Battle-tested; full control; IAM integration | $15-50/month |

**Key requirement:** pgvector support is non-negotiable. Supabase and Neon both include pgvector by default.

#### Redis Hosting

| Provider | Pros | Estimated Cost |
|----------|------|----------------|
| **Upstash** | Serverless; pay-per-request; free tier (10K commands/day) | Free → $10/month |
| **Railway Redis** | Integrated with app hosting | Included in plan |
| **ElastiCache** | AWS-managed; predictable performance | $15+/month |

#### Frontend Hosting

The React SPA is a static build (`vite build` → `dist/` directory):

| Provider | Pros | Estimated Cost |
|----------|------|----------------|
| **Cloudflare Pages** | Global CDN; unlimited bandwidth; Git integration | Free |
| **Vercel** | Excellent DX; preview deployments; analytics | Free (hobby) |
| **Netlify** | Simple; Git integration; forms | Free |

Static hosting is effectively free. The SPA connects to the API via `API_URL` environment variable.

### What Is Intentionally Deferred

| Concern | Why Deferred | When to Address |
|---------|-------------|-----------------|
| Kubernetes | Overkill for MVP; adds massive operational complexity | If/when multi-region or auto-scaling is needed |
| CI/CD pipelines | Manual deploy is acceptable for solo dev | When deploying to production |
| Terraform/IaC | Premature for PaaS deployment | When infrastructure complexity justifies codification |
| Monitoring (Sentry, Grafana) | Pino logs are sufficient for MVP debugging | Before production launch |
| CDN for API | Not needed at MVP traffic levels | If API response latency becomes an issue |
| Multi-region | Single region is fine for initial users | When user base is geographically distributed |
| Backup automation | PaaS providers handle backups | Verify backup policy before storing real user data |

---

## Alternatives Considered

### Full Kubernetes Stack

| Aspect | Assessment |
|--------|------------|
| Approach | Deploy all services to a Kubernetes cluster (EKS, GKE, or k3s) |
| Pros | Production-grade orchestration; auto-scaling; service mesh; health management; industry standard for large deployments |
| Cons | Weeks of setup for a solo founder; YAML configuration sprawl; requires deep K8s knowledge; minimum $50-100/month for managed K8s; operational overhead dominates engineering time |
| Verdict | Rejected — Kubernetes solves problems we don't have (multi-service orchestration, auto-scaling, rolling deployments across dozens of pods). A monolith on PaaS with managed databases achieves the same reliability at a fraction of the complexity. |

### Serverless (AWS Lambda / Vercel Functions)

| Aspect | Assessment |
|--------|------------|
| Approach | Deploy API as serverless functions; use managed services for everything |
| Pros | Zero server management; automatic scaling; pay-per-invocation; no idle costs |
| Cons | Cold starts (1-3 seconds for Node.js) hurt dashboard UX; Fastify isn't designed for serverless (plugin initialization on every cold start); pgvector queries + connection pooling are complex with serverless; WebSocket support for real-time negotiations is limited; vendor lock-in |
| Verdict | Rejected — cold starts are unacceptable for a data-heavy dashboard. Fastify's plugin architecture assumes a long-lived process (connection pools, cached schemas). The embedding/matching pipeline needs persistent connections to PostgreSQL. |

### Self-Hosted VPS (DigitalOcean, Hetzner)

| Aspect | Assessment |
|--------|------------|
| Approach | Rent a VPS, install Docker, manage everything manually |
| Pros | Maximum control; lowest cost ($5-10/month); no vendor abstractions |
| Cons | Full operational responsibility (updates, security patches, backups, monitoring, SSL); single point of failure; no auto-recovery; time spent on ops is time not spent on product |
| Verdict | Deferred — viable for cost optimization after MVP validation. The operational overhead is justified only when PaaS costs become significant relative to revenue. |

---

## Consequences

### Positive

- **Sub-5-minute local setup** — `docker compose up -d` + `pnpm install` + `pnpm dev` gets the full stack running. No manual Postgres/Redis installation.
- **Production-ready foundations** — pgvector, connection pooling, structured logging, health checks, and environment validation are in place from day one. Moving to production is a deployment configuration change, not an architecture change.
- **Near-zero infrastructure cost** — Docker Compose is free locally; PaaS free tiers cover initial deployment. No monthly cloud bills until real users arrive.
- **Operational simplicity** — one Docker Compose file, one monorepo, one database. No service mesh, message queue, or container registry to manage.

### Negative

- **Docker Desktop on Windows** — Docker Desktop can be resource-intensive on Windows 11. WSL 2 backend helps but still consumes memory. Mitigation: keep containers minimal (Alpine-based images, memory caps on Redis).
- **PaaS vendor dependency** — choosing Railway/Render/Fly.io creates some lock-in. Mitigation: the application is a standard Node.js process with PostgreSQL — it runs anywhere that supports these.
- **No staging environment during MVP** — production and development are the only environments. Mitigation: add a staging deployment before launch (Neon's database branching makes this easy).

### Risks

- **Port conflicts** — port 5433 (Postgres) and 3001 (API) may be occupied on the dev machine. Mitigation: env vars allow port overrides; documented in memory notes.
- **Data persistence across Docker rebuilds** — named volumes (`postgres_data`, `redis_data`) persist data. But `docker compose down -v` destroys volumes. Document the distinction.
- **pgvector version compatibility** — the `pgvector/pgvector:pg16` image bundles a specific pgvector version (0.8.1). Production managed Postgres may have a different version. Test compatibility before deploying.
- **Scaling ceiling** — a single PostgreSQL instance with pgvector has a practical limit around 5-10M embeddings before query performance degrades. This is well beyond MVP scale but should be monitored.

---

## References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [pgvector Docker Image](https://hub.docker.com/r/pgvector/pgvector)
- [Railway Documentation](https://docs.railway.app/)
- [Pino Structured Logging](https://getpino.io/)
- [Turborepo Monorepo Guide](https://turbo.build/repo/docs)
- Source: `docker-compose.yml`, `apps/api/src/plugins/db.ts`, `apps/api/src/config/env.ts`, `infrastructure/sql/init.sql`
