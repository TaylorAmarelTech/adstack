# ADR-001: Technology Stack Decisions

**Status:** Accepted
**Date:** 2026-03-07
**Context:** Bootstrapped solo founder building an AI-powered newsletter ad marketplace.

---

## Table of Contents

1. [Package Manager](#1-package-manager)
2. [Monorepo Tool](#2-monorepo-tool)
3. [JavaScript Runtime](#3-javascript-runtime)
4. [Backend Framework](#4-backend-framework)
5. [ORM / Database Client](#5-orm--database-client)
6. [Frontend Framework](#6-frontend-framework)
7. [UI Component Library](#7-ui-component-library)
8. [CSS Framework](#8-css-framework)
9. [Data Fetching](#9-data-fetching)
10. [Charting Library](#10-charting-library)
11. [Validation Library](#11-validation-library)
12. [Testing Framework](#12-testing-framework)
13. [Linting & Formatting](#13-linting--formatting)
14. [Form Library](#14-form-library)

---

## 1. Package Manager

### Decision: **pnpm**

| Option | Pros | Cons |
|--------|------|------|
| **pnpm** | Content-addressable store saves disk space; strict dependency isolation catches phantom deps; native workspace support; 4x faster than npm; battle-tested on Windows 11 | Slightly slower than Bun; occasional issues with packages assuming flat node_modules (rare) |
| npm | Most mature; universal compatibility; zero install needed | Slowest; no disk efficiency; flat node_modules allows phantom deps |
| yarn (Berry) | Good workspace support; PnP mode for speed | Community fragmented (v1 vs Berry); PnP has compatibility issues; config complexity |
| bun | Fastest raw speed (7x npm); built-in bundler/test runner | 6-11x slower installs on native Windows vs WSL (GitHub #10042); ~4800 open issues; youngest ecosystem |

**Why pnpm wins:** Strict dependency isolation catches bugs early. Best disk efficiency via hard-linked content-addressable store. Excellent monorepo workspace support. Mature and reliable on Windows 11. The `pnpm-workspace.yaml` is dead simple.

**Why not Bun:** Documented Windows performance regression makes it unreliable for native Windows development. pnpm is "correct" and also fast.

---

## 2. Monorepo Tool

### Decision: **Turborepo**

| Option | Pros | Cons |
|--------|------|------|
| **Turborepo** | Near-zero config (~20 lines); automatic task graph from package.json scripts; local + remote build caching; 3x faster than Nx for small-medium repos; perfect for solo dev | Less powerful code generation than Nx; no built-in migration generators |
| Nx | Most powerful: module boundary enforcement, affected analysis, project graph viz; excellent for 10+ developer teams | Hours of setup; 200+ lines of config; steep learning curve; overkill for solo founder |
| pnpm workspaces alone | Zero overhead; no extra tool | No build caching; no task orchestration; manual build ordering |

**Why Turborepo wins:** Near-zero configuration cost with immediate benefits (build caching, parallel task execution). Understands package.json scripts natively — no special executors. Remote caching via Vercel is free for personal projects.

**Why not Nx:** Designed for teams of 10+ engineers. The advantages (module boundary enforcement, affected analysis at scale) are unjustified overhead for a solo founder.

---

## 3. JavaScript Runtime

### Decision: **Node.js 22 LTS with tsx**

| Option | Pros | Cons |
|--------|------|------|
| **Node.js + tsx** | 15+ years of battle-testing; every npm package works; optimized Docker images; tsx uses esbuild for fast zero-config TS transpilation | Slightly slower startup than Bun; no built-in bundler |
| Bun | Native TypeScript; fastest runtime; built-in bundler/test runner | Windows performance gaps; ~4800 open issues; less mature Docker ecosystem; potential stability risks |

**Why Node.js wins:** Every npm package, tutorial, and StackOverflow answer assumes Node.js. Docker images are optimized and well-documented. `tsx` gives fast TypeScript execution with zero config. Runtime stability is not something a bootstrapped founder should debug.

**Why not Bun:** Despite Anthropic's acquisition of Oven (Bun), Windows performance gaps remain and the issue count is concerning for production use. The performance difference is irrelevant at our scale (I/O bound on DB queries and API calls, not CPU bound).

---

## 4. Backend Framework

### Decision: **Fastify**

| Option | Pros | Cons |
|--------|------|------|
| **Fastify** | First-class TypeScript generics; 2-3x faster than Express; built-in JSON Schema validation via Ajv; excellent plugin architecture for domain separation; @fastify/swagger auto-generates OpenAPI docs; structured logging via Pino built-in; rich plugin ecosystem (auth, rate limiting, CORS) | More boilerplate than Hono for simple routes; plugin encapsulation model has learning curve |
| Hono | Fastest; cross-runtime (edge, Deno, Bun, Node); lowest boilerplate; excellent TypeScript | Plugin ecosystem less mature for server-side concerns (DB pooling, background jobs, structured logging); designed for edge/serverless, not traditional servers |
| Express | Largest middleware ecosystem; most tutorials; lowest learning curve | No built-in TypeScript; no schema validation; poor async error handling; slowest; legacy |

**Why Fastify wins:** The plugin architecture is ideal for a marketplace (encapsulate auth, billing, ad-matching as separate plugins). Built-in JSON Schema validation means route schemas double as API documentation. The request lifecycle hooks give fine-grained control for auth and rate limiting.

**Why not Hono:** Hono's strength is cross-runtime portability (Cloudflare Workers, Deno). We're deploying to Docker/Node.js — we don't need edge portability. Hono's server-side ecosystem is less mature for the concerns a marketplace needs.

**Why not Express:** Legacy. No built-in TypeScript, no schema validation, poor async error handling, and slower than both alternatives.

---

## 5. ORM / Database Client

### Decision: **Drizzle ORM**

| Option | Pros | Cons |
|--------|------|------|
| **Drizzle** | Native pgvector support (`vector()` column type + distance functions); SQL-like syntax; drizzle-kit generates human-readable SQL migrations; no binary dependencies; tiny runtime footprint; code-first TypeScript schemas | Less "magical" than Prisma; need to understand SQL joins/subqueries; fewer tutorials than Prisma |
| Prisma | Lowest learning curve; excellent DX with generated client; rich ecosystem | Rust query engine binary adds deployment complexity (~15MB); pgvector requires workarounds; abstracts away SQL (problematic for complex ad-matching queries); heavier runtime |
| Kysely | Maximum SQL flexibility; type-safe query builder; tiny footprint | No schema definition; no migration generation; manual TypeScript type management; productivity loss for solo dev |

**Why Drizzle wins:** Native pgvector support with built-in distance functions (`cosineDistance`, `l2Distance`) is critical for the AI-powered ad matching. SQL-like syntax means complex queries (vector similarity + aggregations + window functions) are natural. No binary dependencies simplifies Docker deployments.

**Why not Prisma:** The Rust query engine binary adds deployment complexity. pgvector support requires workarounds. Prisma's abstraction hides SQL — a problem when writing complex ad-matching queries.

**Why not Kysely:** Query builder without schema definition or migration generation. The productivity loss from manually managing migrations and types isn't worth the raw SQL flexibility for a solo dev.

---

## 6. Frontend Framework

### Decision: **Vite + React Router v7 (Declarative/Library Mode)**

| Option | Pros | Cons |
|--------|------|------|
| **Vite + React Router v7** | Pure SPA — no SSR complexity; instant HMR; trivial config; tiny bundles; clean separation from API; deploy as static files anywhere; no Vercel lock-in | No built-in SSR (irrelevant for dashboards); need separate marketing site later for SEO |
| Next.js 15 App Router | Built-in SSR/SSG; Server Components; co-located API routes | RSC/caching complexity (fetch cache, route cache, full route cache, router cache); Vercel lock-in; over-engineered for authenticated dashboards; no SEO benefit behind auth |
| Next.js Pages Router | Simpler than App Router; SSR available | Dated; Webpack-based (slower); still more complex than pure SPA for dashboards |

**Why Vite + React Router wins:** The two main UIs are a publisher dashboard and an advertiser dashboard — authenticated, data-heavy SPAs. They don't need SEO, SSR, or Server Components. Vite gives instant HMR, trivial configuration, and tiny bundles. React Router v7 in declarative mode is the simplest SPA routing available.

**Why not Next.js App Router:** Server Components, server actions, and the complex caching model provide zero benefit for authenticated dashboards. The deployment story pushes toward Vercel. The cognitive overhead of debugging RSC issues is time better spent on product.

**Note on React Router v7:** React Router v7 IS the Remix merge. It offers three modes: Declarative (classic SPA), Data (loaders/actions), and Framework (full Remix SSR). We use Declarative mode — simplest, works with any bundler, no server needed.

**Marketing site later:** If we need SEO-optimized pages, we can add Astro as a separate small app.

---

## 7. UI Component Library

### Decision: **shadcn/ui**

| Option | Pros | Cons |
|--------|------|------|
| **shadcn/ui** | Copy-paste ownership (code lives in your project); built on Radix (accessible); Tailwind-native; includes data tables (TanStack Table), charts (Recharts), sidebar, dialogs; zero runtime dependency; full Tailwind v4 + React 19 support; active community | More assembly than batteries-included libraries; need to copy components individually |
| Mantine | 120+ components + 70+ hooks; built-in form library; comprehensive | Not Tailwind-native; no built-in data grid (third-party needed); larger bundle; own CSS engine |
| Ant Design | Comprehensive enterprise framework; excellent Table/ProTable | Not Tailwind-native; CSS-in-JS (conflicts possible); largest bundle; opinionated styling hard to override |
| Headless UI | Unstyled accessible primitives; tiny | Very limited component set; no tables, charts, or complex components; you build everything |

**Why shadcn/ui wins:** For a data-heavy marketplace dashboard, shadcn/ui provides data tables (TanStack Table), charts (Recharts), sidebar, modals, forms — all styled consistently with Tailwind. Zero lock-in since code lives in your project. When you need a custom campaign status badge or placement approval dialog, you just edit the file.

---

## 8. CSS Framework

### Decision: **Tailwind CSS v4**

| Option | Pros | Cons |
|--------|------|------|
| **Tailwind v4** | CSS-first config (no tailwind.config.js); 5x faster full builds; 100x faster incremental; first-party Vite plugin; automatic content detection; modern CSS features (cascade layers, color-mix) | Different syntax from v3 (migration needed for existing projects); silent failures if misconfigured |
| Tailwind v3 | Most tutorials; proven stable | Requires config file; PostCSS plugin; slower; being superseded |
| CSS Modules | Standard; no extra dependency; scoped by default | Verbose for utility patterns; no design system; slower iteration |
| styled-components | Component-scoped; dynamic styling | Maintenance mode (March 2025); React team recommends against runtime CSS injection |

**Why Tailwind v4 wins:** Zero-config with `@tailwindcss/vite` plugin — no `tailwind.config.js`, no `postcss.config.js`. Just `@import "tailwindcss"` in CSS. Full shadcn/ui compatibility confirmed. CSS-in-JS is effectively dead for new projects in 2026.

---

## 9. Data Fetching

### Decision: **TanStack Query v5**

| Option | Pros | Cons |
|--------|------|------|
| **TanStack Query** | Official DevTools; useMutation with optimistic updates; query invalidation with tag matching; useInfiniteQuery for pagination; automatic garbage collection; configurable stale time; built-in retry; offline support | 13.4KB gzipped (larger than SWR) |
| SWR | Smaller (4.2KB); simple API | No official DevTools; useSWRMutation less mature; no automatic GC; limited offline support |
| Vanilla fetch | Zero bundle cost | Manual caching, invalidation, retries, mutations, loading states — huge DX cost |

**Why TanStack Query wins:** For a dashboard that creates campaigns, approves placements, and manages billing, the mutation system (optimistic updates, rollback on error, automatic invalidation) is essential. DevTools are invaluable for debugging cache state.

---

## 10. Charting Library

### Decision: **Recharts (via shadcn/ui Charts)**

| Option | Pros | Cons |
|--------|------|------|
| **Recharts** | Already integrated in shadcn/ui charts; declarative React components; auto dark-mode; ResponsiveContainer built-in; SVG-based | Moderate bundle; SVG can lag on 10K+ data points |
| Chart.js | Smaller bundle (canvas-based); better for large datasets | Imperative config objects; less React-native feel; separate dependency |
| Nivo | Many chart types; excellent TypeScript | Larger bundle (D3 deps); separate dependency |
| Tremor | Pre-styled dashboard components; highest ease of use | Wraps Recharts anyway; opinionated; less customizable |

**Why Recharts wins:** shadcn/ui already uses it — no extra dependency. Automatic dark-mode theming, consistent styling with rest of UI. Line charts (subscriber growth), bar charts (revenue), pie charts (distribution) — Recharts handles all dashboard analytics needs.

---

## 11. Validation Library

### Decision: **Zod**

| Option | Pros | Cons |
|--------|------|------|
| **Zod** | Ecosystem standard; React Hook Form zodResolver; same schemas validate API requests + form inputs; fastify-type-provider-zod mature; largest community | 15KB gzipped; slower than TypeBox at runtime |
| TypeBox | Fastify-native (JSON Schema); fastest runtime; 5KB | Cannot share with React frontend for form validation; less ecosystem |
| Valibot | Smallest (1KB); fast | Smaller ecosystem; fewer integrations |

**Why Zod wins:** Single source of truth — same Zod schemas validate API request bodies on the server and form inputs on the client via shared `packages/shared` package. Universal ecosystem support (React Hook Form, TanStack, Fastify, OpenAPI).

---

## 12. Testing Framework

### Decision: **Vitest**

| Option | Pros | Cons |
|--------|------|------|
| **Vitest** | Native ESM; 10-20x faster than Jest in watch mode; zero-config TypeScript; shares Vite config; native workspace support for monorepos; Jest-compatible API; built-in coverage | Slightly younger ecosystem |
| Jest | Largest ecosystem; most tutorials | ESM support still experimental; requires ts-jest or @swc/jest config; slow with TypeScript in monorepos |

**Why Vitest wins:** Clearest decision in the entire stack. Native ESM, fast, zero-config TypeScript, monorepo workspace support. Jest's ESM support is still experimental in 2026.

---

## 13. Linting & Formatting

### Decision: **Biome**

| Option | Pros | Cons |
|--------|------|------|
| **Biome** | Single binary; 10-25x faster; one config file (biome.json); 423+ lint rules; Prettier-compatible formatting; zero npm dependencies | Doesn't cover every ESLint plugin; newer ecosystem |
| ESLint + Prettier | Largest ecosystem; every plugin imaginable | Two tools; config file hell (.eslintrc, .prettierrc, .eslintignore, .prettierignore); slower; frequent conflicts between ESLint and Prettier |

**Why Biome wins:** Every minute configuring ESLint + Prettier (and debugging conflicts) is a minute not spent on product. Biome eliminates an entire category of tooling problems with a single binary and one config file.

---

## 14. Form Library

### Decision: **React Hook Form + @hookform/resolvers (Zod)**

| Option | Pros | Cons |
|--------|------|------|
| **React Hook Form** | Smallest re-renders (uncontrolled); Zod integration via resolvers; excellent TypeScript; 25KB; most popular | Uncontrolled approach can be confusing initially |
| Formik | Mature; large community | Larger; more re-renders; less actively maintained |
| Conform | Server-first; progressive enhancement | Designed for Remix/framework mode; overkill for SPA |

**Why React Hook Form wins:** Minimal re-renders for data-heavy dashboard forms. zodResolver connects directly to the shared Zod schemas from `packages/shared`, ensuring frontend validation matches API validation exactly.

---

## Summary

| Layer | Decision | Key Reason |
|-------|----------|------------|
| Package Manager | pnpm | Disk efficient, strict deps, Windows-stable |
| Monorepo | Turborepo | Zero-config build caching |
| Runtime | Node.js 22 + tsx | Battle-tested, stable |
| Backend | Fastify | Plugin architecture, auto-OpenAPI |
| ORM | Drizzle | Native pgvector, SQL-like |
| Frontend | Vite + React Router v7 | Pure SPA, no SSR overhead |
| UI Components | shadcn/ui | Owned code, Tailwind-native |
| CSS | Tailwind v4 | Zero-config, fast |
| Data Fetching | TanStack Query v5 | Mutations, DevTools, cache |
| Charts | Recharts (shadcn) | Already integrated |
| Validation | Zod | Shared frontend + backend |
| Testing | Vitest | Fast, native ESM |
| Lint/Format | Biome | Single tool, fast |
| Forms | React Hook Form | Zod integration, minimal re-renders |
