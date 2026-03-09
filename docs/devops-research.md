# DevOps, Deployment & Operational Patterns Research

## For: TypeScript Monorepo (Fastify API + Vite React + PostgreSQL + Redis)
## Context: Solo founder, bootstrapped SaaS newsletter marketplace, Windows 11

---

## 1. Docker Best Practices for Node.js (2025-2026)

### Base Image Recommendation: `node:22-slim`

| Image | Size | CVEs (typical) | libc | Best For |
|---|---|---|---|---|
| `node:22` (bookworm) | ~1.12 GB | ~997 vulnerabilities | glibc | Development only |
| `node:22-slim` | ~230 MB | ~50 vulnerabilities | glibc | **Production (recommended)** |
| `node:22-alpine` | ~167 MB | ~0 vulnerabilities | musl | Smallest possible image |

**Concrete recommendation: Use `node:22-slim` for production.**

- Alpine is 63 MB smaller but uses musl libc instead of glibc. Some npm packages with native bindings (e.g., `bcrypt`, `sharp`, certain Postgres drivers) can fail or require extra compilation steps on Alpine.
- Slim gives you glibc compatibility with a massive size reduction over the full image.
- If you never use native modules and want the absolute smallest image, Alpine works, but slim is the safer default for a Fastify + Drizzle + PostgreSQL stack.

### Optimal Multi-Stage Dockerfile for the API

```dockerfile
# ============================================
# Stage 1: Base with pnpm
# ============================================
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ============================================
# Stage 2: Install ALL dependencies (for building)
# ============================================
FROM base AS deps
# Copy workspace config and lockfile first (layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy all package.json files (maintains workspace structure)
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
# Fetch packages into pnpm store (cached if lockfile unchanged)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
# Install all dependencies (including devDependencies for build)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ============================================
# Stage 3: Build TypeScript
# ============================================
FROM deps AS build
# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
# Build shared package first, then API
RUN pnpm --filter @newsletter/shared build
RUN pnpm --filter @newsletter/api build

# ============================================
# Stage 4: Production dependencies only
# ============================================
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --prod
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# ============================================
# Stage 5: Final production image
# ============================================
FROM node:22-slim AS production
ENV NODE_ENV=production
WORKDIR /app

# Create non-root user
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid appuser --shell /bin/bash --create-home appuser

# Copy only what's needed
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
# Copy migrations for runtime execution
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) })"

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
```

### How pnpm Works in Docker

pnpm's content-addressable store uses hard links on the host filesystem, but hard links do not work across Docker layers. The solutions:

1. **`pnpm fetch`** -- Downloads packages into the store using only the lockfile. This is the best option for Docker layer caching because `pnpm-lock.yaml` changes less frequently than `package.json`.
2. **BuildKit cache mounts** (`--mount=type=cache,id=pnpm,target=/pnpm/store`) -- Persists the pnpm store across builds without it ending up in image layers.
3. **`pnpm deploy`** -- Alternative approach that copies a single workspace package with all its dependencies into a flat output directory. Useful but less flexible for monorepos where the API imports from shared packages.

**Recommendation: Use `pnpm fetch` + BuildKit cache mounts** as shown in the Dockerfile above.

### .dockerignore

```dockerignore
# Version control
.git
.gitignore

# Dependencies (rebuilt in container)
**/node_modules
**/.pnpm-store

# Build output (rebuilt in container)
**/dist
**/build

# Development files
**/.env
**/.env.*
!**/.env.example

# IDE
.vscode
.idea
*.swp
*.swo

# OS files
Thumbs.db
.DS_Store

# Logs
**/*.log
**/debug.log

# Test coverage
**/coverage

# Docker
**/Dockerfile
**/docker-compose*.yml
**/.dockerignore

# Documentation
**/*.md
docs/
```

---

## 2. Docker Compose for Local Development

### Recommended `docker-compose.yml`

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: newsletter-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-newsletter}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-newsletter_dev}
      POSTGRES_DB: ${POSTGRES_DB:-newsletter_dev}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-newsletter} -d ${POSTGRES_DB:-newsletter_dev}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: newsletter-redis
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 5s
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

### pgvector Image Name

**Yes, `pgvector/pgvector:pg16` is the correct image name.** Available tags include:
- `pgvector/pgvector:pg16` (latest pgvector on Postgres 16)
- `pgvector/pgvector:0.8.2-pg16` (pinned version)
- `pgvector/pgvector:pg16-bookworm` (explicit Debian variant)
- `pgvector/pgvector:pg17` (if you want Postgres 17 instead)

This image is the official Postgres image with pgvector compiled and installed. It behaves identically to the standard `postgres` image.

### Automatic pgvector Extension Initialization

The pgvector Docker image does NOT auto-create the extension. You must do it explicitly. Create this init script:

```sql
-- docker/init-db.sql
-- This runs automatically on first container startup (when volume is empty)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Place this file at `docker/init-db.sql` and mount it to `/docker-entrypoint-initdb.d/`. PostgreSQL's Docker entrypoint runs all `.sql` and `.sh` files in that directory in alphabetical order on first startup (when the data directory is empty).

**Important**: These init scripts only run when the volume is empty (first run). If you add extensions later, run them via Drizzle migrations or manually.

### Development `.env` File Pattern

```env
# .env (for local development -- in .gitignore)

# Database
POSTGRES_USER=newsletter
POSTGRES_PASSWORD=newsletter_dev
POSTGRES_DB=newsletter_dev
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql://newsletter:newsletter_dev@localhost:5432/newsletter_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# API
API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=debug

# JWT / Auth
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (email)
RESEND_API_KEY=re_test_...
FROM_EMAIL=noreply@localhost

# Frontend
VITE_API_URL=http://localhost:3000
VITE_APP_URL=http://localhost:5173
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# OpenAI (for content features)
OPENAI_API_KEY=sk-...

# Tracking
TRACKING_DOMAIN=http://localhost:3000
```

Also create a `.env.example` file that is committed to git with placeholder values.

---

## 3. Reverse Proxy / API Gateway

### Concrete Recommendation: Caddy (for self-hosted) / Not Needed (for PaaS)

**If deploying to Railway, Render, or Fly.io: You do NOT need a reverse proxy.** These platforms handle:
- SSL/TLS termination automatically (free Let's Encrypt certificates)
- HTTP-to-HTTPS redirects
- Custom domain SSL provisioning
- Load balancing

**If self-hosting (Hetzner, DigitalOcean, bare metal): Use Caddy.**

Why Caddy over Nginx/Traefik:
- **Automatic SSL**: Caddy provisions and renews Let's Encrypt certificates with zero configuration. Just use a domain name in the Caddyfile.
- **Simplest config**: A 50-line Nginx config is 3 lines in Caddy.
- **No Certbot cron jobs**: Caddy handles renewal in the background, 30 days before expiration.
- **HTTP/2 and HTTP/3 by default**.

### Caddyfile for This Project (Self-Hosted)

```caddyfile
# API
api.yourdomain.com {
    reverse_proxy localhost:3000
}

# Frontend (if serving from same server)
app.yourdomain.com {
    root * /var/www/newsletter/frontend
    file_server
    try_files {path} /index.html  # SPA fallback
}

# Tracking pixel/link redirects
t.yourdomain.com {
    reverse_proxy localhost:3000
}
```

That is the entire config. Caddy automatically:
- Obtains SSL certificates for all three subdomains
- Redirects HTTP to HTTPS
- Renews certificates before expiration

### Traefik -- When to Choose It

Only if you are running many Docker services and want auto-discovery (Traefik watches Docker labels to auto-configure routing). Overkill for a solo founder with 1-2 services.

### Nginx -- When to Choose It

Only if you need raw maximum throughput, advanced caching rules, or you already know Nginx well. More configuration burden.

---

## 4. Database Migration Strategy

### Drizzle Kit Workflow

```
Development:
  1. Edit schema in TypeScript (e.g., packages/shared/src/db/schema/)
  2. Run: pnpm drizzle-kit generate    --> Creates SQL migration file in drizzle/ folder
  3. Run: pnpm drizzle-kit migrate     --> Applies pending migrations to local DB
  4. Commit the generated SQL migration files to git

Production:
  1. On deploy, run migrations programmatically before the server starts
```

### Running Migrations in Production (Programmatic)

Do NOT use `drizzle-kit migrate` CLI in production. Instead, call `migrate()` from `drizzle-orm` programmatically at app startup:

```typescript
// apps/api/src/db/migrate.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");

  await pool.end();
}
```

```typescript
// apps/api/src/index.ts
import { runMigrations } from "./db/migrate.js";

async function main() {
  // Run migrations before starting the server
  await runMigrations();

  // Then start Fastify
  const app = buildApp();
  await app.listen({ port: 3000, host: "0.0.0.0" });
}

main();
```

### Rollback Strategy

**Drizzle does NOT support automatic rollback / "down" migrations.** This is by design -- many migration tools' down migrations are unreliable in practice.

**What to do instead:**
1. **Make additive, non-destructive changes**: Add columns as nullable, create new tables, add indexes. Never drop columns in the same migration that adds new ones.
2. **To "rollback"**: Create a new forward migration that reverses the change (e.g., drop the column you just added).
3. **Use `drizzle-kit check`**: Detects non-commutative migrations across branches before they cause problems.
4. **Test migrations on a staging database** before running on production.

### Seeding for Development

Drizzle now has a built-in `drizzle-seed` package:

```typescript
// apps/api/src/db/seed.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { seed } from "drizzle-seed";
import * as schema from "./schema/index.js";

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);

  await seed(db, schema, { count: 50 }); // generates 50 entities per table

  console.log("Seeding complete.");
  process.exit(0);
}

main();
```

**Rule of thumb**: If the data defines the system (roles, plans, permissions), put it in a migration. If the data defines the environment (fake users, test newsletters), put it in a seed script.

---

## 5. Environment Variable Management

### Recommendation: Zod Validation (Custom, No Extra Dependency)

Since this project already uses Zod (through Drizzle and API validation), use Zod directly for env validation rather than adding `@t3-oss/env-core` or `envalid`. Fewer dependencies, same result.

```typescript
// packages/shared/src/env.ts
import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Server
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  // Resend
  RESEND_API_KEY: z.string().startsWith("re_"),
  FROM_EMAIL: z.string().email(),

  // OpenAI (optional -- not needed at MVP)
  OPENAI_API_KEY: z.string().optional(),

  // URLs
  APP_URL: z.string().url(),           // Frontend URL
  API_URL: z.string().url(),           // API URL (for CORS, etc.)
  TRACKING_DOMAIN: z.string().url(),   // Tracking pixel/redirect domain
});

export type Env = z.infer<typeof envSchema>;

// Validate and export -- crashes at startup if invalid
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
```

**Why not `@t3-oss/env-core`?** It is a thin wrapper around Zod with added client/server variable separation (useful for Next.js where you must distinguish `NEXT_PUBLIC_*` vars). For a Fastify API, plain Zod does the same thing with zero extra dependencies.

**Why not `envalid`?** Its validators are less flexible than Zod. No post-processing, no union types, limited defaults.

### Frontend Environment Variables (Vite)

Vite exposes only variables prefixed with `VITE_`. Create a separate validation:

```typescript
// apps/web/src/env.ts
import { z } from "zod";

const clientEnvSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_APP_URL: z.string().url(),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
});

export const clientEnv = clientEnvSchema.parse(import.meta.env);
```

### Secrets Management for Production

| Approach | Cost | Complexity | Recommendation |
|---|---|---|---|
| Provider secrets (Railway/Render env vars) | Free | Low | **Start here** |
| Doppler | Free tier (5 users) | Medium | Upgrade path when needed |
| Infisical | Free (self-hosted) | Medium-High | If you need self-hosted |
| AWS/GCP Secrets Manager | ~$0.40/secret/month | High | Overkill at MVP |

**Concrete recommendation**: Use your deployment provider's built-in environment variable management (Railway Variables, Render Environment, Fly.io Secrets). These are encrypted at rest, never exposed in logs, and injected at runtime. Move to Doppler only when you have multiple environments (staging, production, preview) and want a single source of truth that syncs across them.

### Complete Environment Variable List

```
# === REQUIRED IN ALL ENVIRONMENTS ===
DATABASE_URL          # PostgreSQL connection string
REDIS_URL             # Redis connection string
JWT_SECRET            # Min 32 chars, random string
STRIPE_SECRET_KEY     # sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET # whsec_...
RESEND_API_KEY        # re_...
FROM_EMAIL            # e.g., hello@yourdomain.com
APP_URL               # e.g., https://app.yourdomain.com
API_URL               # e.g., https://api.yourdomain.com
TRACKING_DOMAIN       # e.g., https://t.yourdomain.com

# === HAVE DEFAULTS / OPTIONAL ===
API_PORT              # Default: 3000
API_HOST              # Default: 0.0.0.0
NODE_ENV              # Default: development
LOG_LEVEL             # Default: info
JWT_EXPIRES_IN        # Default: 7d
OPENAI_API_KEY        # Optional, for AI features

# === FRONTEND ONLY (VITE_* prefix) ===
VITE_API_URL          # Same as API_URL
VITE_APP_URL          # Same as APP_URL
VITE_STRIPE_PUBLISHABLE_KEY  # pk_test_... or pk_live_...
```

---

## 6. Logging Strategy

### Pino Configuration

```typescript
// apps/api/src/logger.ts
import { FastifyServerOptions } from "fastify";

export function getLoggerConfig(): FastifyServerOptions["logger"] {
  if (process.env.NODE_ENV === "production") {
    return {
      level: process.env.LOG_LEVEL || "info",
      // Redact sensitive fields from logs
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "body.password",
          "body.token",
          "body.creditCard",
        ],
        censor: "[REDACTED]",
      },
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
          };
        },
      },
    };
  }

  // Development: pretty-printed, colored output
  return {
    level: "debug",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: true,
      },
    },
  };
}
```

```typescript
// apps/api/src/app.ts
import Fastify from "fastify";
import { getLoggerConfig } from "./logger.js";

const app = Fastify({
  logger: getLoggerConfig(),
  // Fastify auto-generates a request ID for every request
  genReqId: (req) => crypto.randomUUID(),
});
```

### Log Level Strategy

| Level | When to Use | Examples |
|---|---|---|
| **fatal** | App is about to crash | Database connection permanently lost, out of memory |
| **error** | Operation failed, needs attention | Payment processing failed, email send failed, unhandled exception |
| **warn** | Unusual but handled | Rate limit approached, deprecated API used, retry succeeded after failure |
| **info** | Normal operations worth recording | Server started, user signed up, newsletter sent, subscription changed |
| **debug** | Diagnostic detail | SQL queries, cache hits/misses, request/response bodies, auth token decoded |
| **trace** | Extreme detail | Function entry/exit, variable values mid-computation |

**Production**: Set to `info`. This captures all meaningful business events without drowning in noise.
**Development**: Set to `debug`. See queries, cache behavior, etc.
**Debugging a production issue**: Temporarily lower to `debug` for the affected service.

### Request ID Tracking

Fastify automatically attaches a `reqId` to every request and includes it in all logs for that request. To propagate it to downstream services or background jobs:

```typescript
// In route handlers, the request ID is available:
app.get("/newsletters", async (request, reply) => {
  request.log.info("Fetching newsletters"); // automatically includes reqId
  const newsletters = await getNewsletters(request.id); // pass reqId to services
});
```

### pino-pretty for Development

Install as a dev dependency:
```bash
pnpm add -D pino-pretty
```

This is already configured in the logger config above. In development, logs display as:
```
14:32:15 INFO  Server listening on http://0.0.0.0:3000
14:32:16 DEBUG GET /api/newsletters 200 12ms
14:32:17 WARN  Rate limit: user_123 at 45/50 requests
```

In production, raw JSON (machine-parseable) is emitted:
```json
{"level":30,"time":1709812345678,"reqId":"abc-123","msg":"GET /api/newsletters 200 12ms"}
```

---

## 7. Backup Strategy

### MVP Backup Approach

At MVP scale (small database, few users), daily automated backups are sufficient. As you grow, move to continuous backups with PITR.

### Provider-Managed Backups (Recommended to Start)

| Provider | Automatic Backups | PITR | Retention | Cost |
|---|---|---|---|---|
| **Render** | Yes (continuous) | Yes (7 days) | 7 days | Included in paid DB plans ($7+/mo) |
| **Railway** | **No automatic backups** | No built-in PITR | N/A | Must implement yourself |
| **Fly.io** | Yes (with Supabase/Neon add-on) | Depends on add-on | Varies | Varies |
| **Neon** (managed Postgres) | Yes (continuous) | Yes (7-30 days) | Plan-dependent | Free tier available |
| **Supabase** | Yes (daily) | Yes (7 days Pro, 28 days Team) | Plan-dependent | Free tier available |

**Concrete recommendation**:
- **If using Railway**: Set up a daily `pg_dump` cron job that uploads to S3/R2. Railway's lack of built-in backups is a real gap.
- **If using Render**: Use their built-in PITR. No extra work needed on paid plans.
- **Consider Neon or Supabase** as your managed Postgres provider instead of the platform's built-in DB. Both offer generous free tiers with automatic backups and PITR.

### Self-Managed Backup Script (for Railway or Self-Hosted)

```bash
#!/bin/bash
# scripts/backup-db.sh
# Run via cron: 0 3 * * * /path/to/backup-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="newsletter_backup_${TIMESTAMP}.sql.gz"

# Dump and compress
pg_dump "$DATABASE_URL" | gzip > "/tmp/${BACKUP_FILE}"

# Upload to S3-compatible storage (Cloudflare R2, AWS S3, etc.)
aws s3 cp "/tmp/${BACKUP_FILE}" "s3://newsletter-backups/${BACKUP_FILE}" \
  --endpoint-url "${S3_ENDPOINT_URL}"

# Clean up local file
rm "/tmp/${BACKUP_FILE}"

# Delete backups older than 30 days from S3
aws s3 ls "s3://newsletter-backups/" --endpoint-url "${S3_ENDPOINT_URL}" | \
  awk '{print $4}' | while read file; do
    file_date=$(echo "$file" | grep -oP '\d{8}')
    if [ $(date -d "$file_date" +%s) -lt $(date -d "30 days ago" +%s) ]; then
      aws s3 rm "s3://newsletter-backups/${file}" --endpoint-url "${S3_ENDPOINT_URL}"
    fi
  done
```

### How Often to Backup at MVP Scale

- **Daily full `pg_dump`** is sufficient for < 1 GB databases
- **Upgrade to continuous WAL archiving** (PITR) once you have paying customers or data loss would be costly
- **Always test your restore process**. A backup you have never restored from is not a real backup.

---

## 8. Domain and SSL

### Recommended Domain Architecture

```
app.yourdomain.com    --> Frontend (Vite React SPA)
api.yourdomain.com    --> Fastify API
t.yourdomain.com      --> Tracking (opens, clicks) -- points to same API
```

### Custom Domain Setup by Provider

**Railway:**
1. Add custom domain in Railway dashboard
2. Set CNAME record: `api.yourdomain.com` -> `your-service.up.railway.app`
3. Railway auto-provisions Let's Encrypt SSL
4. **Note**: CNAME for `authorize.railwaydns.net` must NOT be proxied through Cloudflare during initial verification

**Render:**
1. Add custom domain in Render dashboard
2. Set CNAME records as specified by Render
3. SSL auto-provisioned, including wildcard domains
4. Wildcard requires 3 CNAME records

**Fly.io:**
1. Run `fly certs create api.yourdomain.com`
2. Set CNAME: `api.yourdomain.com` -> `your-app.fly.dev`
3. For wildcard: Use DNS-01 challenge

**Hetzner + Caddy (self-hosted):**
1. Point A records to your Hetzner server IP
2. Use the Caddyfile shown in Section 3
3. Caddy auto-provisions SSL for all configured domains
4. For wildcard certs: Install `caddy-dns/hetzner` plugin and use DNS-01 challenge via Hetzner DNS API

### Cloudflare: Proxy Mode vs DNS-Only

| Feature | Proxy Mode (orange cloud) | DNS-Only (gray cloud) |
|---|---|---|
| DDoS protection | Yes | No |
| CDN caching | Yes | No |
| Origin IP hidden | Yes | No (IP exposed) |
| WebSocket support | Yes | N/A |
| Analytics | Full HTTP analytics | DNS-only analytics |
| SSL at edge | Cloudflare's cert | Your origin's cert |
| Speed | Faster (edge cache + routing) | Direct to origin |

**Concrete recommendation:**
- **Frontend (app.yourdomain.com)**: Proxy mode ON. Static assets benefit from Cloudflare's CDN caching.
- **API (api.yourdomain.com)**: Proxy mode ON, but set SSL/TLS mode to "Full (Strict)" to ensure end-to-end encryption. Disable caching for API routes (Cloudflare won't cache dynamic responses by default, but be explicit).
- **Tracking (t.yourdomain.com)**: Proxy mode ON. The extra latency is negligible for tracking pixels, and you get DDoS protection.
- **When deploying to Railway/Render**: Some verification steps require DNS-Only temporarily. Switch to Proxy after verification.

**Important SSL/TLS setting**: When using Cloudflare Proxy mode with Railway/Render/Fly.io (which have their own SSL), set Cloudflare SSL mode to **"Full (Strict)"** to avoid redirect loops.

---

## 9. Monorepo Deployment Patterns

### Recommended Architecture: Separate Deployments

```
apps/api/     --> Railway / Render / Fly.io (Docker container)
apps/web/     --> Cloudflare Pages (static files, free)
packages/     --> Not deployed (build-time dependency only)
```

### Why Separate Deployments

1. **Frontend on CDN is free and fast**: Cloudflare Pages offers unlimited bandwidth, 500 builds/month, global CDN with 300+ nodes. Vercel and Netlify have 100 GB/month free.
2. **Independent scaling**: API scales based on compute needs; frontend scales via CDN (effectively infinite).
3. **Independent deploys**: Change a button color? Deploy only the frontend in 30 seconds. No API restart needed.
4. **Cost**: Serving static files from a Node.js server wastes compute dollars.

### Should the API Serve the Frontend?

**No.** Keep them separate. The only reason to bundle them would be to avoid CORS configuration, but CORS is a one-time 5-minute setup. The benefits of separation far outweigh the minor CORS configuration.

### Frontend Deployment: Cloudflare Pages (Recommended)

**Why Cloudflare Pages over Vercel/Netlify:**
- Unlimited bandwidth (Vercel/Netlify cap at 100 GB free)
- 500 builds/month free
- Native monorepo support
- Fastest global CDN

**Setup:**
1. Connect GitHub repo to Cloudflare Pages
2. Set build configuration:
   - Root directory: `apps/web`
   - Build command: `cd ../.. && pnpm install && pnpm --filter @newsletter/shared build && pnpm --filter @newsletter/web build`
   - Build output directory: `dist`
3. Set environment variables: `VITE_API_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`, etc.

### Selective Deployment (Only Deploy What Changed)

**For the API (Railway/Render):**
- Railway and Render watch for git pushes and rebuild on every commit by default.
- Use a `railway.json` or `render.yaml` with a root directory filter:

```json
// railway.json (or configure in Railway dashboard)
{
  "build": {
    "dockerfilePath": "apps/api/Dockerfile",
    "watchPatterns": ["apps/api/**", "packages/shared/**", "pnpm-lock.yaml"]
  }
}
```

On Render, set the "Root Directory" to the repo root but use a custom build filter to check if relevant paths changed.

**For the Frontend (Cloudflare Pages):**
- Cloudflare Pages builds on every push by default.
- Use the "Build Watch Paths" feature (in Pages settings):
  - Include: `apps/web/**`, `packages/shared/**`
  - This skips builds when only `apps/api/` changes.

**With GitHub Actions (most flexible):**

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      web: ${{ steps.filter.outputs.web }}
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api:
              - 'apps/api/**'
              - 'packages/shared/**'
              - 'pnpm-lock.yaml'
            web:
              - 'apps/web/**'
              - 'packages/shared/**'
              - 'pnpm-lock.yaml'

  deploy-api:
    needs: detect-changes
    if: needs.detect-changes.outputs.api == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Deploy to Railway/Render/Fly.io via their CLI or API

  deploy-web:
    needs: detect-changes
    if: needs.detect-changes.outputs.web == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Cloudflare Pages handles this via its own git integration,
      # but you can trigger via wrangler CLI if needed
```

---

## Summary: Concrete Choices for This Project

| Decision | Choice | Reasoning |
|---|---|---|
| Docker base image | `node:22-slim` | glibc compatibility, small size, low CVEs |
| Local dev DB | `pgvector/pgvector:pg16` + `redis:7-alpine` | Pre-built pgvector, Alpine Redis is tiny |
| Reverse proxy | Caddy (self-hosted) or None (PaaS) | Auto-SSL, simplest config |
| Migrations | Drizzle `generate` + programmatic `migrate()` | Run at container startup, no CLI in prod |
| Env validation | Zod (direct, no wrapper library) | Already a dependency, full type safety |
| Secrets (production) | Provider env vars, then Doppler | Start simple, upgrade when needed |
| Logging | Pino (built into Fastify) + pino-pretty dev | 5x faster than Winston, structured JSON |
| Backups | Provider-managed PITR or daily pg_dump to S3/R2 | Render best for built-in; Railway needs DIY |
| SSL/Domains | Provider auto-SSL + Cloudflare proxy (Full Strict) | Zero-config SSL, DDoS protection |
| Frontend hosting | Cloudflare Pages | Free, unlimited bandwidth, global CDN |
| API hosting | Railway or Render | Simple Docker deploys, managed infrastructure |
| Deployment strategy | Separate (API + Frontend) with path-based filtering | Independent deploys, cost-efficient |

---

## Sources

### Docker & Node.js Images
- [Choosing the best Node.js Docker image (Snyk)](https://snyk.io/blog/choosing-the-best-node-js-docker-image/)
- [Alpine, Slim, Bullseye, Bookworm differences explained](https://medium.com/@faruk13/alpine-slim-bullseye-bookworm-noble-differences-in-docker-images-explained-d9aa6efa23ec)
- [node - Official Docker Image](https://hub.docker.com/_/node/)
- [How to choose the right Docker base image](https://oneuptime.com/blog/post/2026-02-08-how-to-choose-the-right-docker-base-image-for-your-application/view)
- [9 Tips for Containerizing Your Node.js Application (Docker)](https://www.docker.com/blog/9-tips-for-containerizing-your-node-js-application/)
- [Top 4 Tactics To Keep Node.js Rockin' in Docker](https://www.docker.com/blog/keep-nodejs-rockin-in-docker/)
- [Modern Docker Best Practices for 2025](https://talent500.com/blog/modern-docker-best-practices-2025/)

### pnpm + Docker
- [Working with Docker (pnpm official docs)](https://pnpm.io/docker)
- [pnpm fetch (official docs)](https://pnpm.io/cli/fetch)
- [pnpm deploy (official docs)](https://pnpm.io/cli/deploy)
- [Optimal Dockerfile for Node.js with pnpm (Depot)](https://depot.dev/docs/container-builds/optimal-dockerfiles/node-pnpm-dockerfile)
- [Docker multistage builds with a pnpm monorepo (Discussion)](https://github.com/orgs/pnpm/discussions/4777)
- [Optimized multi-stage Docker builds with TurboRepo and PNPM](https://fintlabs.medium.com/optimized-multi-stage-docker-builds-with-turborepo-and-pnpm-for-nodejs-microservices-in-a-monorepo-c686fdcf051f)

### Docker Compose & pgvector
- [pgvector/pgvector Docker Image](https://hub.docker.com/r/pgvector/pgvector)
- [Setting Up PostgreSQL with pgvector in Docker](https://medium.com/@adarsh.ajay/setting-up-postgresql-with-pgvector-in-docker-a-step-by-step-guide-d4203f6456bd)
- [pgvector extension creation in Docker image (Issue #512)](https://github.com/pgvector/pgvector/issues/512)
- [Docker Compose Health Checks guide](https://last9.io/blog/docker-compose-health-checks/)
- [Control startup order - Docker Compose](https://docs.docker.com/compose/how-tos/startup-order/)
- [Postgres and Redis containers with Docker Compose](https://sevic.dev/notes/postgres-redis-docker-compose/)

### Reverse Proxy
- [Reverse Proxy Comparison: Traefik vs Caddy vs Nginx](https://www.programonaut.com/reverse-proxies-compared-traefik-vs-caddy-vs-nginx-docker/)
- [Caddy vs Nginx vs Traefik comprehensive analysis](https://tolumichael.com/caddy-vs-nginx-vs-traefik-a-comprehensive-analysis/)
- [Caddy Automatic HTTPS documentation](https://caddyserver.com/docs/automatic-https)
- [Common Caddyfile Patterns](https://caddyserver.com/docs/caddyfile/patterns)
- [Caddy Reverse Proxy in 2025](https://www.virtualizationhowto.com/2025/09/caddy-reverse-proxy-in-2025-the-simplest-docker-setup-for-your-home-lab/)

### Drizzle Migrations
- [Drizzle ORM Migrations overview](https://orm.drizzle.team/docs/migrations)
- [drizzle-kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)
- [drizzle-kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Migrations Rollback discussion](https://github.com/drizzle-team/drizzle-orm/discussions/1339)
- [Drizzle migrations to Postgres in production](https://budivoogt.com/blog/drizzle-migrations)
- [Drizzle Seed overview](https://orm.drizzle.team/docs/seed-overview)
- [8 Drizzle ORM Patterns for Clean, Fast Migrations](https://medium.com/@bhagyarana80/8-drizzle-orm-patterns-for-clean-fast-migrations-456c4c35b9d8)

### Environment Variables
- [Why T3 Env is My Go-To for Managing Environment Variables](https://www.mwskwong.com/blog/why-t3-env-is-my-go-to-for-managing-environment-variables)
- [T3 Env Core documentation](https://env.t3.gg/docs/core)
- [Environment variables type safety with Zod](https://www.creatures.sh/blog/env-type-safety-and-validation/)
- [znv - Type-safe env parsing with Zod](https://github.com/lostfictions/znv)
- [Infisical vs Doppler comparison 2025](https://www.doppler.com/blog/infisical-doppler-secrets-management-comparison-2025)
- [Top 6 secrets management tools 2025](https://www.doppler.com/blog/secrets-management-tools-2025)

### Logging
- [Logging (Fastify official docs)](https://fastify.dev/docs/latest/Reference/Logging/)
- [Complete Guide to Pino Logging in Node.js (Better Stack)](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/)
- [Production-Grade Logging with Pino (Dash0)](https://www.dash0.com/guides/logging-in-node-js-with-pino)
- [Pino Logger Complete Guide 2026 (SigNoz)](https://signoz.io/guides/pino-logger/)
- [A deep dive into logging with Pino (Platformatic)](https://blog.platformatic.dev/a-deep-dive-into-pino)

### Backups
- [Automated PostgreSQL Backups (Railway blog)](https://blog.railway.com/p/automated-postgresql-backups)
- [Render Postgres Recovery and Backups](https://render.com/docs/postgresql-backups)
- [Top 5 PostgreSQL backup tools in 2025](https://dev.to/rostislav_dugin/top-5-postgresql-backup-tools-in-2025-5801)
- [Top Managed PostgreSQL Services Compared 2025](https://seenode.com/blog/top-managed-postgresql-services-compared/)

### Domain & SSL
- [Working with Domains (Railway docs)](https://docs.railway.com/networking/domains/working-with-domains)
- [Custom Domains on Render](https://render.com/docs/custom-domains)
- [Custom domains (Fly.io docs)](https://fly.io/docs/networking/custom-domain/)
- [Cloudflare Proxy Status docs](https://developers.cloudflare.com/dns/proxy-status/)
- [Cloudflare SSL/TLS encryption modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)

### Monorepo Deployment
- [Monorepos (Cloudflare Pages docs)](https://developers.cloudflare.com/pages/configuration/monorepos/)
- [Deploying a Static Site (Vite docs)](https://vite.dev/guide/static-deploy)
- [Railway vs Render vs Fly.io comparison](https://codeyaan.com/blog/top-5/railway-vs-render-vs-flyio-comparison-2624)
- [Multi-Service Architectures on Render](https://render.com/docs/multi-service-architecture)
