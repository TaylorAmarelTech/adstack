# ADR-002: Authentication & Authorization

**Status:** Accepted
**Date:** 2026-03-08
**Decision Makers:** Engineering Team

---

## Context

AdStack is a two-sided marketplace with two distinct user types — **publishers** (who own newsletters and sell ad inventory) and **advertisers** (who create campaigns and buy ad placements). Each user type has different permissions and access patterns:

- Publishers manage newsletters, subscribers, ad slots, and approve/reject placements.
- Advertisers manage campaigns, creatives, budgets, and initiate negotiations.
- A future **admin** role will handle platform moderation, dispute resolution, and billing oversight.

The authentication system must:

1. Securely authenticate users across both the Fastify API and the React SPA frontend.
2. Support role-based access control (RBAC) with clean route-level enforcement.
3. Protect against common web vulnerabilities (XSS, CSRF, token theft).
4. Remain simple enough for a solo founder to maintain without a dedicated security team.
5. Not introduce heavy third-party dependencies during MVP.

---

## Decision

**Cookie-based JWT authentication with HMAC-SHA256 signing, argon2id password hashing, and role-based access control.**

---

## Details

### Token Strategy: JWT in httpOnly Cookies

Tokens are signed JWTs stored in `httpOnly` cookies — never in `localStorage` or `sessionStorage`.

| Property | Value |
|----------|-------|
| Cookie name | `adstack_session` |
| httpOnly | `true` (JavaScript cannot read the token — prevents XSS token theft) |
| secure | `true` in production (cookie only sent over HTTPS) |
| sameSite | `lax` (prevents CSRF on state-changing requests from third-party sites) |
| domain | Configurable via `COOKIE_DOMAIN` env var |
| maxAge | 7 days (`604800` seconds) |

**Why cookies over bearer tokens:**

- `httpOnly` cookies are inaccessible to JavaScript, eliminating the most common XSS token theft vector.
- The browser automatically attaches cookies to every request — no client-side token management code needed.
- `sameSite: lax` provides baseline CSRF protection without requiring custom CSRF tokens for GET requests.

### JWT Signing: Built-in Node.js Crypto

JWTs are signed using HMAC-SHA256 via Node.js built-in `node:crypto` module — no `jsonwebtoken` dependency.

```
Header:  { "alg": "HS256", "typ": "JWT" }
Payload: { "id": "<uuid>", "email": "<email>", "role": "<role>", "iat": <unix>, "exp": <unix> }
```

The implementation uses `createHmac('sha256', secret)` with base64url encoding. The signing secret is validated at startup via Zod (minimum 32 characters, configured via `SESSION_SECRET` env var).

**Why no `jsonwebtoken` package:** The HMAC-SHA256 signing logic is ~40 lines of code. Eliminating the dependency reduces supply chain attack surface and avoids a package that has had past security advisories.

### Token Expiry and Refresh

- **7-day token expiry** — long enough for dashboard users who return daily, short enough to limit damage from token compromise.
- **Sliding window refresh** (planned) — when a request arrives with a token that has less than 1 day remaining, a new token is issued automatically in the response cookie. This avoids forcing re-login for active users.
- No separate refresh tokens during MVP — the sliding window approach keeps the implementation simple.

### Password Hashing: argon2id

Passwords are hashed using **argon2id** (via the `argon2` npm package), the winner of the Password Hashing Competition and recommended by OWASP.

| Property | Rationale |
|----------|-----------|
| Algorithm | argon2id (hybrid — resistant to both side-channel and GPU attacks) |
| Memory cost | 64 MB (default — makes GPU/ASIC attacks expensive) |
| Time cost | 3 iterations |
| Parallelism | 4 threads |

**Why not bcrypt:** bcrypt is limited to 72-byte passwords and uses a fixed 4 KB memory cost — trivially parallelizable on modern GPUs. argon2id's configurable memory-hardness provides a stronger security margin.

### Role-Based Access Control

Three roles are defined in the system:

| Role | Access |
|------|--------|
| `publisher` | Newsletter management, subscriber data, ad slot configuration, placement approval |
| `advertiser` | Campaign management, creative upload, negotiation, billing |
| `admin` | All publisher + advertiser routes, plus moderation, dispute resolution, platform settings |

Role enforcement is implemented at the route level via Fastify's `preHandler` hooks:

- **`authenticate`** — Rejects unauthenticated requests with 401. Extracts user from JWT cookie and attaches to `request.user`.
- **`optionalAuth`** — Attempts authentication but does not reject. Used for public routes that show extra data to logged-in users.
- Route groups enforce role checks: `/api/v1/publisher/*` routes verify `role === 'publisher'`, `/api/v1/buyer/*` routes verify `role === 'advertiser'`.

### Separate User Tables

Publishers and advertisers are stored in separate database tables (`publishers`, `advertisers`) rather than a single `users` table. Each table has its own `email`, `passwordHash`, and domain-specific fields (e.g., publishers have `plan`, `stripeConnectAccountId`; advertisers have `stripeCustomerId`, agent config).

**Why separate tables:** The two user types have fundamentally different data shapes, relationships, and business logic. A single `users` table would require extensive JSONB or nullable columns. Separate tables keep queries clean and enforce domain boundaries.

### CORS Configuration

CORS is configured to support cookie-based auth across the SPA and API:

- `credentials: true` — allows cookies to be sent cross-origin.
- `origin` — set to `true` (permissive) in development, locked to `APP_URL` in production.
- Allowed headers include `Content-Type`, `Authorization`, and `X-Request-Id`.

---

## Alternatives Considered

### Session-Based Auth with Redis

| Aspect | Assessment |
|--------|------------|
| Approach | Store session ID in cookie, session data in Redis |
| Pros | Easy server-side revocation; no token size limits; session data stays server-side |
| Cons | Every request hits Redis (latency + operational dependency); harder to scale horizontally; Redis is a SPOF for auth |
| Verdict | Rejected — adds operational complexity. JWT's stateless verification is sufficient for MVP scale. Redis is used for caching and rate limiting, not as an auth dependency. |

### OAuth2/OIDC (Social Login)

| Aspect | Assessment |
|--------|------------|
| Approach | Delegate authentication to Google, GitHub, etc. via OAuth2 |
| Pros | No password management; higher conversion (one-click signup); trusted identity providers |
| Cons | Complex to implement correctly; requires client ID/secret management per provider; doesn't eliminate the need for internal roles/sessions; adds third-party dependency for core auth flow |
| Verdict | Deferred — will be added as a supplementary login method after MVP. Email/password is the baseline. |

### Passport.js

| Aspect | Assessment |
|--------|------------|
| Approach | Use Passport.js middleware for auth strategy abstraction |
| Pros | 500+ authentication strategies; well-known in Express ecosystem |
| Cons | Express-centric (awkward Fastify integration); heavy abstraction for simple email/password; not TypeScript-first; adds dependency for something achievable in ~100 lines |
| Verdict | Rejected — designed for Express middleware patterns, not Fastify's plugin architecture. The auth plugin is simple enough to own. |

### Bearer Tokens in Authorization Header

| Aspect | Assessment |
|--------|------------|
| Approach | Return JWT in response body, client stores in localStorage, sends via `Authorization: Bearer` header |
| Pros | Works with any client (mobile, CLI); no cookie configuration needed |
| Cons | `localStorage` is accessible to any JavaScript on the page (XSS vulnerability); requires client-side token management; no automatic sending by browser |
| Verdict | Rejected for web SPA — XSS risk is unacceptable for a marketplace handling billing data. May be used for future API key access. |

---

## Consequences

### Positive

- **XSS-resistant token storage** — httpOnly cookies cannot be read by JavaScript, eliminating the most common token theft vector.
- **Zero client-side token management** — the browser handles cookie attachment automatically; the React app never touches the token.
- **Minimal dependencies** — HMAC-SHA256 via `node:crypto` and `argon2` are the only auth-related dependencies. No `jsonwebtoken`, no `passport`, no session store.
- **Clean role enforcement** — Fastify's `preHandler` hooks provide declarative, route-level access control that is easy to audit.
- **Type-safe session** — `SessionUser` type from `@adstack/shared` ensures the user object shape is consistent across API and frontend.

### Negative

- **No server-side revocation during MVP** — JWTs cannot be individually revoked without a blocklist. Compromised tokens remain valid until expiry (7 days). Mitigation: short-ish expiry + sliding window.
- **Separate user tables add join complexity** — queries that span both user types (e.g., "find the other party in a negotiation") require union queries or separate lookups.
- **Cookie-based auth complicates future mobile/CLI clients** — mobile apps and CLI tools may prefer bearer tokens. Solution: add API key support later as a parallel auth mechanism.

### Risks

- **Session secret rotation** — changing `SESSION_SECRET` invalidates all existing tokens. Need a rotation strategy (dual-secret verification) before production.
- **CSRF on non-GET mutations** — `sameSite: lax` allows cookies on top-level navigations. For additional protection, consider adding a CSRF token for state-changing requests (POST/PUT/DELETE) in production.
- **argon2 native compilation** — the `argon2` package requires native compilation (node-gyp). If this causes Docker build issues, fallback to `@node-rs/argon2` (Rust-based, prebuilt binaries).

---

## References

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [RFC 7519 — JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
- [Fastify Cookie Plugin](https://github.com/fastify/fastify-cookie)
- [argon2 Password Hashing Competition Winner](https://www.password-hashing.net/)
- Source: `apps/api/src/plugins/auth.ts`, `apps/api/src/config/env.ts`, `packages/shared/src/schemas/auth.ts`
