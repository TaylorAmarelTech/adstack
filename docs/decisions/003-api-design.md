# ADR-003: API Design & Patterns

**Status:** Accepted
**Date:** 2026-03-08
**Decision Makers:** Engineering Team

---

## Context

AdStack is a two-sided marketplace with a complex domain spanning publishers, newsletters, subscribers, advertisers, campaigns, creatives, negotiations, placements, and settlements. The API must:

1. Serve two distinct SPA dashboards (publisher and advertiser) with data-heavy CRUD operations.
2. Support an AI-powered matching engine that connects advertiser audiences to newsletter subscriber clusters.
3. Provide agent-to-agent negotiation endpoints for automated ad buying.
4. Generate accurate API documentation for future third-party integrations and ESP webhooks.
5. Validate input rigorously — bad data in a financial marketplace has real monetary consequences.

The API design must balance simplicity (solo founder) with extensibility (marketplace complexity will grow).

---

## Decision

**RESTful API with consistent response envelope, domain-organized routes, Zod validation at the edge, and automatic OpenAPI documentation.**

---

## Details

### Response Envelope

Every API response uses a consistent wrapper format, defined as shared Zod schemas in `@adstack/shared`:

**Success response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**List response (with pagination):**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

**Error response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": { ... }
  }
}
```

**Why an envelope:** The `success` boolean lets clients branch without inspecting HTTP status codes. The consistent `error.code` field enables programmatic error handling (e.g., `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`). The shared Zod schemas (`commonSchemas.apiResponse`, `commonSchemas.apiError`) ensure the envelope is type-safe on both server and client.

### Route Organization by Domain

Routes are organized by user role and domain context:

```
/api/v1/
  health               — Health check (public)
  auth/                — Login, register, logout, me
  publisher/
    newsletters/       — CRUD newsletters
    newsletters/:id/
      subscribers/     — Subscriber management
      ad-slots/        — Ad slot configuration
      placements/      — Placement approval/tracking
    settings/          — Publisher settings
  buyer/
    campaigns/         — CRUD campaigns
    campaigns/:id/
      creatives/       — Creative management
      placements/      — Placement tracking
    matching/          — Audience matching engine
    negotiations/      — Negotiation management
  agent/
    negotiate/         — Agent-to-agent negotiation
    match/             — Automated matching
```

**Why domain-based, not resource-based:** A flat resource-based structure (`/newsletters`, `/campaigns`, `/subscribers`) becomes ambiguous in a marketplace — does `/placements` show the publisher's or advertiser's view? Domain-based routing (`/publisher/placements` vs `/buyer/placements`) encodes the access context and simplifies auth middleware.

### Zod Validation at the Edge

All request bodies, query parameters, and URL parameters are validated using Zod schemas via `fastify-type-provider-zod`:

- Schemas are defined in `packages/shared/src/schemas/` — the single source of truth.
- The same schemas validate API requests on the server and form inputs on the frontend (via `zodResolver` with React Hook Form).
- Invalid requests are rejected with a 400 status and detailed validation errors before reaching any business logic.
- The Zod type provider automatically infers TypeScript types from schemas — no manual `Request<Body, Params, Query>` generics.

### Automatic OpenAPI/Swagger Generation

The Fastify Swagger plugin (`@fastify/swagger` + `@fastify/swagger-ui`) auto-generates OpenAPI 3.0 documentation:

- Zod schemas are transformed to JSON Schema via `fastify-type-provider-zod`'s `jsonSchemaTransform`.
- Swagger UI is available at `/docs` in all environments.
- Tags organize endpoints by domain: Health, Auth, Publisher, Newsletter, Campaign, Matching.
- No manually maintained OpenAPI YAML — documentation is always in sync with code.

### Pagination: Offset-Based

Pagination uses offset-based (`page` + `limit`) rather than cursor-based:

| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `page` | integer | 1 | - |
| `limit` | integer | 20 | 100 |

The `paginationQuery` Zod schema in `@adstack/shared` handles coercion (query params arrive as strings) and bound enforcement.

**Why offset over cursor:**

- Dashboard UIs need "page 3 of 8" — cursor-based pagination cannot provide total counts without a separate query.
- Dataset sizes are bounded (a publisher has tens of newsletters, not millions).
- Offset-based is simpler to implement and debug.
- If a table grows large enough for offset to degrade (e.g., subscribers), cursor-based can be added for that specific endpoint.

### Rate Limiting

Rate limiting is planned per-route using `@fastify/rate-limit` backed by Redis:

| Route Category | Limit | Window |
|----------------|-------|--------|
| Auth (login/register) | 10 requests | 15 minutes |
| Matching engine | 30 requests | 1 minute |
| General API | 100 requests | 1 minute |
| Webhook ingestion | 500 requests | 1 minute |

Redis is already provisioned in Docker Compose for this purpose.

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| URL paths | kebab-case | `/api/v1/publisher/ad-slots` |
| JSON fields | camelCase | `{ "subscriberCount": 100 }` |
| Query params | camelCase | `?minEngagementScore=0.5` |
| Enum values | snake_case | `"campaign_status": "in_progress"` |
| Database columns | snake_case | `subscriber_count` |
| HTTP methods | Standard REST | GET (read), POST (create), PUT/PATCH (update), DELETE (remove) |

### Error Codes

Standardized error codes for programmatic handling:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body/params failed Zod validation |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Authenticated but insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate resource (e.g., email already registered) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Versioning

All routes are prefixed with `/api/v1`. The version is a constant in `@adstack/shared` (`API_PREFIX = '/api/v1'`). When breaking changes are needed, a `/api/v2` prefix can coexist with v1 during migration.

---

## Alternatives Considered

### GraphQL

| Aspect | Assessment |
|--------|------------|
| Approach | Single `/graphql` endpoint with typed schema and resolvers |
| Pros | Clients fetch exactly the fields they need (no over-fetching); excellent for complex nested queries (e.g., campaign → placements → newsletters); strong typing via SDL; built-in introspection |
| Cons | N+1 query problem requires DataLoader; caching is harder (no HTTP cache semantics); error handling is non-standard (always 200); security surface (deeply nested queries, query complexity attacks); significant setup cost (schema, resolvers, code generation); overkill for two known clients |
| Verdict | Rejected — the two clients (publisher dashboard, advertiser dashboard) are known and controlled. REST with Zod schemas provides equivalent type safety with simpler caching, error handling, and debugging. GraphQL's flexibility shines with unknown/many clients; we have two. |

### tRPC

| Aspect | Assessment |
|--------|------------|
| Approach | End-to-end type-safe RPC — server procedures exported as TypeScript types consumed directly by the client |
| Pros | Zero-cost type safety across client/server; no code generation; excellent DX |
| Cons | Tightly couples client and server (same TypeScript project required); no OpenAPI generation for third-party consumers; non-standard protocol (not REST); harder to debug with standard HTTP tools (curl, Postman); subscription/websocket support less mature |
| Verdict | Rejected — AdStack will eventually expose APIs to third parties (ESP webhooks, partner integrations). tRPC's TypeScript-only constraint and lack of OpenAPI output would force a rewrite. Zod schemas in a shared package achieve similar type safety without the coupling. |

### gRPC

| Aspect | Assessment |
|--------|------------|
| Approach | Protocol Buffers + HTTP/2 for strongly-typed RPC |
| Pros | Fastest serialization; bi-directional streaming; polyglot support; excellent for internal microservices |
| Cons | Browser clients require grpc-web proxy; not human-readable (binary protocol); Protobuf schema management adds tooling; overkill for monolith; poor developer ergonomics for debugging |
| Verdict | Rejected — designed for microservice-to-microservice communication, not browser-to-monolith. The added infrastructure (envoy proxy for grpc-web) is unjustifiable for a monolith serving two SPAs. |

---

## Consequences

### Positive

- **Single source of truth for validation** — Zod schemas in `@adstack/shared` validate both API requests and frontend forms. A change to the schema immediately surfaces type errors in both apps.
- **Auto-generated, always-accurate documentation** — Swagger UI at `/docs` reflects the actual code. No manual OpenAPI YAML maintenance.
- **Debuggable with standard tools** — REST endpoints work with curl, Postman, browser DevTools. No special clients or protocol understanding needed.
- **Progressive complexity** — start with simple CRUD routes, add matching engine complexity in the same pattern. No architectural shift needed.
- **Cacheable** — HTTP caching semantics (ETags, Cache-Control) can be added per-route for read-heavy endpoints like newsletter listings.

### Negative

- **Over-fetching on some endpoints** — REST returns full objects. The publisher dashboard might only need 3 of 15 campaign fields. Mitigation: use `select` query parameter for field filtering if this becomes a measurable performance issue.
- **Multiple round trips for complex views** — a dashboard overview might need newsletters + recent placements + revenue summary = 3 API calls. Mitigation: create aggregate endpoints (e.g., `/publisher/dashboard-summary`) for known composite views.
- **Envelope adds verbosity** — every response wraps data in `{ success, data }`. This is a minor payload increase but provides significant client-side ergonomic benefits.

### Risks

- **Pagination edge case** — offset-based pagination returns inconsistent results if rows are inserted/deleted between page fetches. This is acceptable for dashboard UIs but would need cursor-based pagination for real-time feeds.
- **API versioning overhead** — maintaining v1 and v2 simultaneously is operationally expensive. Strategy: avoid breaking changes via additive evolution (add fields, never remove or rename). Version bump only for truly incompatible changes.
- **Rate limit tuning** — initial limits are estimates. Need monitoring to identify appropriate thresholds per route category.

---

## References

- [Fastify Type Provider Zod](https://github.com/turkerdev/fastify-type-provider-zod)
- [Fastify Swagger](https://github.com/fastify/fastify-swagger)
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/)
- Source: `packages/shared/src/schemas/common.ts`, `apps/api/src/plugins/swagger.ts`, `packages/shared/src/constants/index.ts`
