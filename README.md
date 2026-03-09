# AdStack — AI-Powered Newsletter Ad Marketplace

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+pgvector-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white)](https://turbo.build/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A two-sided marketplace connecting newsletter publishers with advertisers using AI-powered subscriber embeddings for precision ad matching. Subscribers are represented as 768-dimensional vectors enabling cosine similarity targeting, so advertisers reach the right audience and publishers maximize ad revenue.

---

## Features

- **Publisher Dashboard** -- Manage newsletters, define ad slots, track subscriber metrics and revenue
- **Advertiser Dashboard** -- Create campaigns, upload creatives, target audiences by interest
- **AI-Powered Matching** -- Subscriber embeddings (768-dim vectors via OpenAI) enable cosine similarity targeting through pgvector
- **Audience Clustering** -- Subscribers are grouped into semantic clusters for easy advertiser targeting
- **Authentication** -- Cookie-based sessions with Argon2 password hashing, role-based access (publisher / advertiser)
- **API-First Design** -- RESTful API with auto-generated OpenAPI/Swagger documentation
- **Shared Validation** -- Zod schemas shared between frontend and backend for consistent validation
- **ESP Integrations** -- Connectors for Beehiiv, ConvertKit, and Mailchimp

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 22 LTS + tsx | TypeScript execution, ESM-native |
| **Monorepo** | pnpm workspaces + Turborepo | Dependency management, build caching |
| **API** | Fastify 5 | HTTP server, plugin architecture |
| **Database** | PostgreSQL 16 + pgvector | Relational data + vector similarity search |
| **ORM** | Drizzle ORM | Type-safe queries, SQL-like syntax, migrations |
| **Cache** | Redis 7 | Session store, rate limiting, caching |
| **Frontend** | Vite 7 + React 19 + React Router v7 | SPA dashboard |
| **UI** | shadcn/ui + Tailwind CSS v4 | Component library, utility-first CSS |
| **Data Fetching** | TanStack Query v5 | Cache management, mutations, DevTools |
| **Forms** | React Hook Form + Zod resolver | Performant forms with shared validation |
| **Validation** | Zod | Shared schemas (API + frontend) |
| **Auth** | Argon2 + signed cookies | Password hashing, session management |
| **Testing** | Vitest | Unit and integration tests |
| **Lint/Format** | Biome | Single-tool linting and formatting |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://www.docker.com/) & Docker Compose

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/adstack.git
cd adstack

# 2. Install dependencies
pnpm install

# 3. Copy environment file and configure
cp .env.example .env

# 4. Start PostgreSQL (with pgvector) and Redis
docker compose up -d

# 5. Generate database migrations
pnpm db:generate

# 6. Run migrations
pnpm db:migrate

# 7. Start all apps in development mode
pnpm dev
```

The API will be available at `http://localhost:3001` and the frontend at `http://localhost:5173`.

### Environment Variables

Copy `.env.example` to `.env` and configure the following:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | API server port | `3001` |
| `LOG_LEVEL` | Pino log level | `debug` |
| `APP_URL` | Frontend URL | `http://localhost:5173` |
| `API_URL` | API URL | `http://localhost:3001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://adstack:adstack_dev@localhost:5433/adstack_dev` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SESSION_SECRET` | Secret for signing session cookies | _(change in production)_ |
| `OPENAI_API_KEY` | OpenAI API key for generating subscriber embeddings | -- |
| `STRIPE_SECRET_KEY` | Stripe secret key for payment processing | -- |
| `ENCRYPTION_KEY` | Key for encrypting sensitive fields at rest | _(change in production)_ |

See [`.env.example`](.env.example) for the full list including ESP and email provider configuration.

---

## API Reference

**Base URL:** `http://localhost:3001/api/v1`
**Swagger UI:** `http://localhost:3001/docs`

All endpoints return responses in the format:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

### Endpoints

#### Auth (`/api/v1/auth`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/auth/register` | Register a new publisher or advertiser | No |
| `POST` | `/auth/login` | Log in and receive session cookie | No |
| `GET` | `/auth/me` | Get current authenticated user | Yes |
| `POST` | `/auth/logout` | Log out and clear session | No |

#### Publisher (`/api/v1/publisher`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/publisher/profile` | Get publisher profile | Yes |
| `PUT` | `/publisher/profile` | Update publisher profile | Yes |
| `GET` | `/publisher/newsletters` | List publisher's newsletters | Yes |
| `POST` | `/publisher/newsletters` | Create a newsletter | Yes |
| `GET` | `/publisher/newsletters/:id` | Get newsletter details | Yes |
| `PUT` | `/publisher/newsletters/:id` | Update a newsletter | Yes |
| `DELETE` | `/publisher/newsletters/:id` | Delete a newsletter | Yes |
| `GET` | `/publisher/newsletters/:id/slots` | List ad slots for a newsletter | Yes |
| `POST` | `/publisher/newsletters/:id/slots` | Create an ad slot | Yes |

#### Buyer / Advertiser (`/api/v1/buyer`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/buyer/profile` | Get advertiser profile | Yes |
| `PUT` | `/buyer/profile` | Update advertiser profile | Yes |
| `GET` | `/buyer/campaigns` | List campaigns | Yes |
| `POST` | `/buyer/campaigns` | Create a campaign | Yes |
| `GET` | `/buyer/campaigns/:id` | Get campaign details | Yes |
| `PUT` | `/buyer/campaigns/:id` | Update a campaign | Yes |
| `GET` | `/buyer/campaigns/:id/creatives` | List creatives for a campaign | Yes |
| `POST` | `/buyer/campaigns/:id/creatives` | Upload a creative | Yes |

#### Health (`/api/v1`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/health` | Health check | No |

---

## Project Structure

```
adstack/
├── apps/
│   ├── api/                    # Fastify backend API (@adstack/api)
│   │   └── src/
│   │       ├── config/         # Environment validation (Zod)
│   │       ├── db/
│   │       │   └── schema/     # Drizzle table definitions (one per table)
│   │       ├── plugins/        # Fastify plugins (CORS, Swagger, DB, Auth)
│   │       └── routes/
│   │           ├── auth.ts     # Authentication routes
│   │           ├── health.ts   # Health check
│   │           ├── publisher/  # Publisher domain routes
│   │           └── buyer/      # Advertiser domain routes
│   └── web/                    # Vite + React SPA dashboard (@adstack/web)
│       └── src/
├── packages/
│   └── shared/                 # Shared Zod schemas, types, constants (@adstack/shared)
│       └── src/
│           └── schemas/        # Validation schemas (auth, publisher, newsletter, campaign)
├── docs/
│   └── decisions/              # Architecture Decision Records
├── infrastructure/
│   └── sql/                    # Database init scripts (pgvector extension)
├── docker-compose.yml          # PostgreSQL + Redis services
├── turbo.json                  # Turborepo pipeline configuration
├── biome.json                  # Linter & formatter config
└── pnpm-workspace.yaml         # Workspace definition
```

### Database Schema (13 tables)

`publishers` | `advertisers` | `newsletters` | `subscribers` | `campaigns` | `creatives` | `ad-slots` | `ad-placements` | `negotiations` | `transactions` | `consent-log` | `embeddings` | `clusters`

---

## Architecture

### How AI-Powered Ad Matching Works

```
                                       ┌──────────────┐
  Newsletter subscribers ──────────►   │  OpenAI API  │
  (engagement data,                    │  Embeddings  │
   content preferences)               └──────┬───────┘
                                              │
                                    768-dim vectors
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │   PostgreSQL     │
                                    │   + pgvector     │
                                    │                  │
                                    │  cosine_distance │
                                    │  similarity      │
                                    │  search          │
                                    └────────┬────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                    ┌───────────┐     ┌────────────┐     ┌────────────┐
                    │  Audience │     │  Campaign   │     │    Ad      │
                    │  Clusters │     │  Targeting  │     │  Placement │
                    └───────────┘     └────────────┘     └────────────┘
```

1. **Subscriber Embeddings** -- Subscriber engagement data and content preferences are converted into 768-dimensional vectors using OpenAI's embedding models.

2. **Vector Storage** -- Embeddings are stored in PostgreSQL using the pgvector extension, enabling efficient similarity search with indexing.

3. **Audience Clustering** -- Subscribers are grouped into semantic clusters based on embedding similarity, giving publishers insight into their audience composition.

4. **Campaign Targeting** -- Advertisers define target audiences. The system uses cosine similarity to match campaigns with newsletters whose subscribers are most relevant.

5. **Marketplace Flow** -- Publishers list ad slots on their newsletters. Advertisers create campaigns with creatives. The platform facilitates placement negotiations, approval, and transaction processing.

---

## Development

### Commands

```bash
pnpm dev              # Start all apps in dev mode (API + Web)
pnpm build            # Build all packages
pnpm lint             # Lint with Biome
pnpm format           # Format with Biome
pnpm check            # Lint + format (auto-fix)
pnpm test             # Run all tests
pnpm typecheck        # TypeScript type checking
pnpm clean            # Clean all build artifacts
```

### Database Management

```bash
pnpm db:generate      # Generate Drizzle migrations from schema changes
pnpm db:migrate       # Apply pending migrations
pnpm db:studio        # Open Drizzle Studio (visual DB browser)
docker compose up -d  # Start PostgreSQL + Redis
docker compose down   # Stop services
```

### Infrastructure

The project uses Docker Compose for local development services:

- **PostgreSQL 16** with pgvector extension (port `5433`)
- **Redis 7** Alpine with AOF persistence (port `6379`)

---

## Architecture Decision Records

Design decisions are documented in [`docs/decisions/`](docs/decisions/):

| ADR | Title | Status |
|-----|-------|--------|
| [001](docs/decisions/001-technology-stack.md) | Technology Stack | Accepted |
| [002](docs/decisions/002-authentication.md) | Authentication & Authorization | Accepted |
| [003](docs/decisions/003-api-design.md) | API Design & Patterns | Accepted |
| [004](docs/decisions/004-ai-ml-pipeline.md) | AI/ML Embedding Pipeline | Accepted |
| [005](docs/decisions/005-data-model.md) | Data Model & Schema Design | Accepted |
| [006](docs/decisions/006-infrastructure.md) | Infrastructure & Deployment | Accepted |

---

## License

This project is licensed under the [MIT License](LICENSE).
