# AdStack — AI-Powered Newsletter Ad Marketplace

## Project Overview

Two-sided marketplace connecting newsletter publishers with advertisers using AI-powered subscriber embeddings for precision ad matching. Subscribers are represented as 768-dimensional vectors enabling cosine similarity targeting.

## Architecture

- **Monorepo**: pnpm workspaces + Turborepo
- **API**: Fastify 5 (TypeScript) with Zod type provider
- **Database**: PostgreSQL 16 + pgvector (Drizzle ORM)
- **Frontend**: Vite + React Router v7 (declarative mode) + shadcn/ui + Tailwind v4
- **Validation**: Zod (shared between frontend and backend via @adstack/shared)
- **Testing**: Vitest
- **Lint/Format**: Biome

## Project Structure

```
apps/api/          — Fastify backend API (@adstack/api)
apps/web/          — Vite React dashboard (@adstack/web)
packages/shared/   — Shared Zod schemas, types, constants (@adstack/shared)
docs/decisions/    — Architecture Decision Records (ADRs)
infrastructure/    — Docker, SQL init scripts
```

## Key Conventions

- ESM everywhere (`"type": "module"`, `.js` extensions in imports)
- Zod schemas in `packages/shared/src/schemas/` are the single source of truth for validation
- Fastify plugins in `apps/api/src/plugins/` use `fastify-plugin` wrapper
- Routes organized by domain: `routes/publisher/`, `routes/buyer/`, `routes/agent/`
- Database schema in `apps/api/src/db/schema/` — one file per table
- Environment variables validated via Zod in `apps/api/src/config/env.ts`
- All timestamps use `withTimezone: true` in Drizzle schema
- UUIDs for all primary keys (`.defaultRandom()`)

## Commands

```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all packages
pnpm lint         # Lint with Biome
pnpm test         # Run all tests
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Drizzle Studio
docker compose up -d  # Start PostgreSQL + Redis
```

## Database

- PostgreSQL on port 5432 (user: adstack, password: adstack_dev, db: adstack_dev)
- Redis on port 6379
- pgvector extension enabled for vector similarity search
- Drizzle ORM with `drizzle-kit generate` for migrations (human-readable SQL)

## API Patterns

- Routes return `{ success: true, data: ... }` or `{ success: false, error: { code, message } }`
- Zod validation via `fastify-type-provider-zod` auto-generates OpenAPI docs
- Swagger UI at `/docs`
- Health check at `/api/v1/health`
- All API routes prefixed with `/api/v1`

## Current State

- v0.1 MVP in progress
- Core schema defined (publishers, newsletters, subscribers, campaigns, placements, embeddings, clusters)
- Fastify server with health check and newsletter list routes
- Shared Zod schemas for auth, publisher, newsletter, campaign
