---
spec-id: SPEC-037
title: "Security Gaps Remediation (SPEC-019 Post-Audit)"
type: security
complexity: high
status: completed
created: 2026-03-07T00:00:00.000Z
parent: SPEC-019
---

# SPEC-037: Security Gaps Remediation (SPEC-019 Post-Audit)

## 1. Overview

### Goal

Remediate 49 verified security gaps discovered during the 4-pass post-implementation audit of SPEC-019 (Security & Permissions Hardening). These gaps range from crypto weaknesses and information leaks to permission inconsistencies and dead code that creates false security assumptions.

### Motivation

SPEC-019 was completed on 2026-03-02 and addressed the major security concerns. However, a thorough 4-pass audit by 6 specialized agents uncovered residual issues that, while not as critical as the original SPEC-019 scope, still represent real security risks, code quality issues, and architectural inconsistencies that should be resolved before production launch.

### Success Criteria

- All 49 gaps resolved (code fix, config change, or documented as accepted risk)
- Zero timing-unsafe secret comparisons
- Zero PII in INFO-level logs
- Zero `Math.random()` for any string generation utility
- All permission checks use `PermissionEnum` (no direct role checks)
- Health endpoints expose no internal details (DB errors, NODE_ENV)
- Dead sanitization code removed from validation middleware
- Route architecture follows three-tier pattern (billing, reports, exchange-rates, cron)
- CSP headers present (Report-Only mode) on web and admin
- CI pipeline blocks on critical/high CVEs
- All GitHub workflows use consistent Node 20 + pnpm v4

### Gap Source

Full analysis: `.claude/specs/specs-gaps-019.md` (4-pass audit, 6 agents, line-number references)

### Decisions Made During Review

| Gap | Decision | Reason |
|-----|----------|--------|
| GAP-01 | Deferred to SPEC-024 | Credential rotation needs formal spec |
| GAP-02 | Deferred to SPEC-025 | Staging environment needs formal spec |
| GAP-07 | Discarded | Covered by SPEC-035 (env vars cleanup) |
| GAP-08 | Document as limitation | Entitlements fail-closed is by design |
| GAP-15 | Discarded | Low priority docs cleanup |
| GAP-37 | False positive | CORS middleware already forces credentials=false on wildcard |
| GAP-38 | False positive | isMockAuthAllowed() requires NODE_ENV=test |
| GAP-44 | Accepted risk | Permissions are user's own data, needed for client-side gating |
| GAP-50 | Discarded | Intentional design for load balancer health checks |
| GAP-51 | False positive | Not logging allowed access is standard pattern |
| GAP-53 | Discarded | Covered by another spec |
| GAP-65 | Document only | Vercel free plan limitation (daily vs hourly cron) |

---

## 2. User Stories & Acceptance Criteria

### US-01: Crypto & Auth Hardening

**As a** security engineer
**I want** all secret comparisons to be timing-safe and all random generation to use crypto-grade sources
**So that** the system is resistant to timing attacks and predictable token generation

**Acceptance Criteria:**

```gherkin
Given the cron middleware receives a request with Authorization header
When it compares the provided secret against HOSPEDA_CRON_SECRET
Then it uses crypto.timingSafeEqual (not ===)

Given env.ts validates HOSPEDA_BETTER_AUTH_SECRET
When the value has fewer than 32 characters
Then validation fails with a clear error message

Given a Google OAuth clientId is configured
When the corresponding clientSecret is missing or empty
Then env validation fails at startup with a cross-validation error

Given any code calls randomString() from @repo/utils
When generating a string
Then it uses crypto.getRandomValues() (not Math.random())

Given the API generates a request ID
When creating the X-Request-ID header value
Then it uses crypto.randomUUID()

Given auth.ts references the HOST role
When assigning or comparing roles
Then it uses RoleEnum.HOST (not string literal 'HOST')

Given auth/me.ts checks for guest actor
When determining if actor is guest
Then it uses isGuestActor() (not string literal 'GUEST')

Given createSystemActor() creates a privileged actor
When the actor object is created
Then it includes _isSystemActor: true flag
And authorization middleware rejects actors with this flag from HTTP contexts
```

### US-02: Information Leak Prevention

**As a** security engineer
**I want** no internal details leaked through API responses or logs
**So that** attackers cannot fingerprint the system or harvest PII from logs

**Acceptance Criteria:**

```gherkin
Given the /health/db endpoint encounters a database error
When returning the error response
Then it shows "Database health check failed" (not raw PostgreSQL error)
And it does not include NODE_ENV in the response body

Given a contact form submission is logged
When the log entry is written at INFO level
Then it contains contactType, accommodationId, messageLength
And it does NOT contain firstName, lastName, or email

Given the super admin seeder generates a random password
When the password is displayed
Then it is written to stderr via console.warn (not to structured logger)
And environment-variables.md documents this behavior

Given billing subscription logic logs a preapproval ID
When writing the log entry
Then the ID is masked (e.g., "***...a1b2")

Given a file upload fails validation
When the error response is returned
Then it uses a generic message (not the raw file.name from the client)

Given billing-usage.service encounters a database error
When HOSPEDA_API_DEBUG_ERRORS is false (production)
Then the error result contains "Failed to get system usage stats"
When HOSPEDA_API_DEBUG_ERRORS is true (development)
Then the error result contains the actual error message
```

### US-03: Rate Limiting & Middleware Integrity

**As a** platform operator
**I want** rate limiting to work correctly per-user on Vercel and middleware to not contain dead code
**So that** abuse prevention works and the codebase is honest about its protections

**Acceptance Criteria:**

```gherkin
Given the API is deployed on Vercel
When API_RATE_LIMIT_TRUST_PROXY is documented
Then deployment docs specify it must be set to true for Vercel

Given an unauthenticated request hits POST /auth/signout
When it includes a spoofed X-Forwarded-For header
Then rate limits are NOT cleared for that IP

Given getEndpointType() receives a path
When classifying the path for rate limiting
Then it uses startsWith-based matching (not includes)

Given the contact form endpoint
When a client sends more than 5 requests per minute
Then subsequent requests are rate-limited with 429

Given the validation middleware
When processing requests
Then it does NOT contain dead header sanitization code (Object.assign on Headers)
And it does NOT contain dead query param sanitization code (defineProperty on c.req)
```

### US-04: Permission System Consistency

**As a** security engineer
**I want** all authorization checks to use PermissionEnum consistently
**So that** the permission system is the single source of truth for access control

**Acceptance Criteria:**

```gherkin
Given authorization.ts, billing-admin-guard.middleware.ts, and permission.ts
When checking SUPER_ADMIN access
Then they rely on permission checks (not actor.role === RoleEnum.SUPER_ADMIN)

Given promo-codes.ts validates admin access
When a non-admin user attempts the operation
Then it throws HTTPException(403) (not Error which causes 500)
And the check uses PermissionEnum (not role comparison)

Given a USER_BOOKMARK_VIEW_ANY permission exists
When an ADMIN with this permission lists bookmarks by entity
Then they can see all users' bookmarks
When a regular user lists bookmarks by entity
Then they see only their own bookmarks

Given a METRICS_RESET permission exists
When POST /metrics/reset is called
Then it requires this specific permission

Given billing ownership middleware encounters an unknown resource type
When the request includes a resource ID
Then it returns 403 (fail-closed, not pass-through)
```

### US-05: Webhook Transaction Safety

**As a** billing engineer
**I want** subscription status updates and audit logs to be atomic
**So that** webhook processing doesn't leave inconsistent state

**Acceptance Criteria:**

```gherkin
Given a MercadoPago webhook triggers a subscription status update
When the update is processed
Then the status change and audit log insert run inside a database transaction

Given the deprecated webhookEventIds Map
When checking the webhook utils exports
Then it is no longer exported or present

Given Redis becomes unavailable during rate limiting
When the system falls back to in-memory
Then a warning is logged (not silently swallowed)
```

### US-06: Route Architecture Compliance

**As a** API architect
**I want** all routes to follow the three-tier architecture
**So that** middleware chains are correct and there's no tier duplication

**Acceptance Criteria:**

```gherkin
Given exchange-rate protected tier
When checking for write operation files
Then no orphan write files exist (create, update-config, delete, fetch-now)

Given exchange-rate routes
When checking for duplication between protected and admin tiers
Then each operation exists in exactly one tier (no duplication)

Given billing admin operations (system metrics, approaching limits)
When accessed by admin users
Then they are served from /admin/billing/ tier (not /protected/billing/)

Given cron routes
When triggered by Vercel scheduler
Then they use the cron-secret protected path
And admin panel uses /admin/cron/ for manual triggers
```

### US-07: XSS & Frontend Security

**As a** frontend security engineer
**I want** JSON-LD output to be properly escaped and CSP headers to be present
**So that** XSS vectors are eliminated

**Acceptance Criteria:**

```gherkin
Given Breadcrumb.astro and propietarios/index.astro
When rendering JSON-LD structured data
Then < characters are escaped as \u003c (or they use the JsonLd component)

Given accommodation routes with path parameters
When the parameter is not a valid UUID
Then the route returns 400 validation error

Given apps/web/vercel.json and apps/admin/vercel.json
When checking security headers
Then Content-Security-Policy-Report-Only is present
```

### US-08: CI/CD Consistency

**As a** DevOps engineer
**I want** CI pipelines to block on critical vulnerabilities and use consistent tooling
**So that** insecure code doesn't reach production

**Acceptance Criteria:**

```gherkin
Given the CI pipeline runs pnpm audit
When critical or high vulnerabilities are found
Then the pipeline fails (not continue-on-error)

Given all GitHub workflows
When checking Node.js version and pnpm action
Then they all use Node 20 and pnpm/action-setup@v4

Given package.json engines
When checking the node constraint
Then it requires >=20 (not >=18)
```

### US-09: Code Quality

**As a** developer
**I want** no Spanish comments, no console.* in production code, and correct error handling
**So that** the codebase follows project standards

**Acceptance Criteria:**

```gherkin
Given userBookmark.permissions.ts
When checking code quality
Then there are no Spanish comments and no commented-out code

Given auth.ts and past-due-grace.middleware.ts
When logging errors or warnings
Then they use @repo/logger (not console.error/console.warn)

Given webhook event-handler.ts
When accessing error.stack
Then it checks instanceof Error first

Given documentation examples in service-core/docs and api/docs
When showing permission checks
Then they use PermissionEnum (not actor.role !== RoleEnum.ADMIN)
```

---

## 3. Technical Approach

### Architecture

No architectural changes. All fixes are within existing patterns:
- Middleware modifications follow existing Hono middleware conventions
- Permission additions follow existing PermissionEnum + seed pattern
- Route migrations follow existing three-tier factory pattern
- Tests follow existing Vitest + testing patterns

### Key Patterns to Follow

- **Permission checks**: Use `PermissionEnum` via `actor.permissions?.includes()`
- **Env validation**: Use Zod `superRefine` for cross-field validation
- **Timing-safe comparison**: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`
- **Secure random**: `crypto.getRandomValues()` for strings, `crypto.randomUUID()` for IDs
- **Error masking**: Generic message by default, detailed when `HOSPEDA_API_DEBUG_ERRORS=true`
- **Route factory**: `createAdminRoute`, `createProtectedRoute`, `createSimpleRoute`

### Key Files

| Category | Files |
|----------|-------|
| Crypto | `apps/api/src/cron/middleware.ts`, `packages/utils/src/string.ts`, `apps/api/src/utils/request-id.ts` |
| Auth | `apps/api/src/lib/auth.ts`, `apps/api/src/utils/env.ts`, `apps/api/src/utils/actor.ts` |
| Info leaks | `apps/api/src/routes/health/db-health.ts`, `apps/api/src/routes/contact/submit.ts`, `packages/seed/src/utils/superAdminLoader.ts` |
| Rate limit | `apps/api/src/middlewares/rate-limit.ts`, `apps/api/src/routes/auth/signout.ts`, `apps/api/src/middlewares/validation.ts` |
| Permissions | `apps/api/src/middlewares/authorization.ts`, `apps/api/src/middlewares/billing-admin-guard.middleware.ts`, `packages/service-core/src/utils/permission.ts` |
| Billing | `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`, `apps/api/src/middlewares/billing-ownership.middleware.ts` |
| Routes | `apps/api/src/routes/index.ts`, `apps/api/src/routes/exchange-rates/`, `apps/api/src/routes/billing/` |
| Frontend | `apps/web/src/components/shared/Breadcrumb.astro`, `apps/web/vercel.json`, `apps/admin/vercel.json` |
| CI/CD | `.github/workflows/ci.yml`, `.github/workflows/refresh-search.yml`, `.github/workflows/docs.yml` |

### Decisions

- **GAP-14 (route migration)**: Clean cut, no backward-compatible redirects. Frontend updated in same task.
- **GAP-45 (CSP)**: Start with `Content-Security-Policy-Report-Only` to detect violations without breaking.
- **GAP-27/47 (bookmarks)**: `USER_BOOKMARK_VIEW_ANY` seeded for ADMIN + SUPER_ADMIN only.
- **GAP-03 (trust proxy)**: Config change in Vercel + documentation (not code default change).
- **GAP-61 (error detail)**: Controlled by existing `HOSPEDA_API_DEBUG_ERRORS` env var.

---

## 4. Risks

| # | Risk | Impact | Probability | Mitigation |
|---|------|--------|-------------|------------|
| 1 | GAP-14 route migration breaks admin panel URLs | HIGH | MEDIUM | Update frontend in same task, test with Playwright |
| 2 | Removing SUPER_ADMIN bypass causes permission denial | HIGH | LOW | SUPER_ADMIN already seeded with all permissions; verify with tests |
| 3 | CSP Report-Only blocks legitimate resources | LOW | LOW | Report-Only mode doesn't block, only reports |
| 4 | Bookmark ownership filter breaks existing queries | MEDIUM | LOW | Thorough unit tests for owner vs admin scenarios |
| 5 | Env validation changes break existing deployments | MEDIUM | MEDIUM | min(32) for auth secret - verify all envs have 32+ char secrets |

---

## 5. Testing Strategy

### Unit Tests
- Timing-safe comparison in cron middleware
- Env validation rejects short secrets, missing OAuth secrets
- randomString uses crypto, requestId is UUID format
- Health endpoint sanitizes errors
- getEndpointType uses startsWith correctly
- Billing ownership returns 403 for unknown types
- UserBookmark filters by owner

### Integration Tests
- Permission-based access (SUPER_ADMIN via permissions, not role bypass)
- Promo-codes returns 403 (not 500) for unauthorized
- Contact form rate limited at 5/min
- Signout doesn't clear rate limit without auth
- Subscription webhook uses transaction

### Existing Tests
- All existing tests must continue passing
- No test modifications needed except for tests that explicitly test removed behaviors (SUPER_ADMIN bypass)

---

## 6. Tasks (Suggested)

See plan file for full 32-task breakdown across 11 phases. Summary:

| Phase | Tasks | Gaps Covered |
|-------|-------|-------------|
| Setup | T-001, T-002 | GAP-27, 21, 48 |
| Crypto & Auth | T-003 to T-005 | GAP-23, 40, 24, 16, 39, 52, 56 |
| Info Leak Prevention | T-006 to T-008 | GAP-25, 35, 29, 11, 46, 66, 58, 61 |
| Rate Limit & Middleware | T-009 to T-011 | GAP-03, 30, 43, 62, 41, 42, 48 |
| Permission Consistency | T-012 to T-015 | GAP-05, 33, 27, 47, 21, 49 |
| Webhook & Transactions | T-016, T-017 | GAP-04, 31, 20 |
| Route Architecture | T-018 to T-022 | GAP-32, 22, 14 |
| XSS & Frontend | T-023 to T-025 | GAP-06, 28, 45 |
| CI/CD & Tooling | T-026, T-027 | GAP-12, 55, 63, 64 |
| Code Quality | T-028 to T-030 | GAP-36, 59, 17, 60, 57 |
| Documentation | T-031, T-032 | GAP-18, 19, 54, 08, 44, 65 |
