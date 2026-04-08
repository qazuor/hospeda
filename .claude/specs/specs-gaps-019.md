# SPEC-019: Security & Permissions Hardening - Gap Analysis

> Generated: 2026-03-04 | Re-audited: 2026-03-07 (pass #2, #3) | **Re-audited exhaustively: 2026-03-07 (pass #4)**
> Spec status: `completed` (2026-03-02)
> Tasks: 47/53 completed, 3 obsolete (Fly.io/Docker N/A - Vercel deployment), 5 deferred to SPEC-024, 1 deferred to SPEC-025

---

## Methodology

### Pass #4 (2026-03-07, current)

This re-audit was performed by **6 specialized agents** in parallel:

1. **Tech Lead #1 (Middleware)**: Rate limiting, CORS, body size, error filtering, cron, metrics, health, signout, auth/me, bodyLimit, env config
2. **Code Reviewer (Permissions)**: Permission system, auth, billing IDOR, super admin, route guards, full codebase grep for role checks
3. **Tech Lead #2 (XSS/Frontend)**: All `set:html` usages, JSON-LD, DOMPurify, dependency versions, Vercel headers, hardcoded secrets
4. **Hono Engineer (Routes)**: Three-tier compliance, route mapping, parameter validation, billing ownership, webhook security, contact endpoints
5. **Tech Lead #3 (Anti-patterns)**: Injection (SQL/SSRF/command), weak crypto, info disclosure, mass assignment, race conditions, file upload, session security, env validation
6. **Tech Lead #4 (Docs/Config)**: Documentation vs code, CI/CD workflows, Vercel config, git security, package.json, tsconfig

Each agent performed exhaustive file-by-file analysis with line-number references. Results were cross-verified and deduplicated.

### Previous passes

- Pass #1: 2026-03-04 (4 agents)
- Pass #2: 2026-03-07 (4 agents)
- Pass #3: 2026-03-07 (5 agents)

---

## Executive Summary

| Category | Count |
|----------|-------|
| **Previously reported gaps now RESOLVED** | 12 (9 in passes #2-3 + 3 in pass #4) |
| **Previously reported gaps still OPEN** | 29 |
| **NEW gaps discovered in pass #4** | 28 |
| **Total active gaps** | 57 |

### Resolved in Pass #4 (newly confirmed)

| Previous Gap | Resolution |
|---|---|
| GAP-09: createErrorResponse 5xx details | `hideDetails` logic at `response.ts:344-348` correctly filters on status >= 500 when `HOSPEDA_API_DEBUG_ERRORS` is false |
| GAP-26: TOCTOU in promo code apply | `tryRedeemAtomically` uses `SELECT FOR UPDATE` inside transaction. Pre-check is outside but over-redemption is prevented by the lock. Mitigated. |
| GAP-34: Dead-letter limit/offset validation | Routes use `AdminSearchBaseSchema` with `pageSize` validated via `.int().min(1).max(100)`. Not a real problem. |

---

## Priority Matrix (Pass #4 - 2026-03-07)

| Priority | Count | Gap IDs |
|----------|-------|---------|
| CRITICAL | 2 | GAP-01, GAP-23 |
| HIGH | 8 | GAP-02, GAP-03, GAP-04, GAP-24, GAP-25, GAP-37, GAP-38, GAP-39 |
| MEDIUM | 27 | GAP-05 to GAP-08, GAP-11, GAP-12, GAP-14, GAP-27 to GAP-33, GAP-40 to GAP-55 |
| LOW | 17 | GAP-15 to GAP-19, GAP-35, GAP-36, GAP-56 to GAP-66 |
| INFORMATIONAL | 3 | GAP-20 to GAP-22 |

---

## CRITICAL

---

### GAP-01: Credential rotation and git history purge not started (SPEC-024)

- **Status**: OPEN (carried from pass #1)
- **Audit passes**: #1, #2, #3, #4
- **Priority**: CRITICAL
- **Severity**: CRITICAL
- **Complexity**: High (multi-phase coordination)
- **Related Spec Tasks**: T-007 to T-011 (deferred to SPEC-024)
- **Related US**: US-02 (Exposed Git History Secrets)

#### Description

5 tasks were deferred to SPEC-024 which is still in `draft` status with NO tasks generated and NO work started. The MercadoPago production access token, database URL, Better Auth secret, and 15+ other credentials are exposed in the git history via the `.env` file committed in `33bd4124`.

#### Proposed Solutions

1. **Execute SPEC-024 as-is** (recommended) .. approve and execute the full 6-phase plan
2. **Fast-track CRITICAL credentials only** .. rotate MercadoPago, DB, Auth secret immediately, defer the rest

#### Recommendation

Execute SPEC-024 immediately. This is the single highest security risk in the project. **Requires formal SPEC, not a direct fix.**

#### Files

- `.env` (in git history, commits `33bd4124` and `bacbf585`)
- `.claude/specs/SPEC-024-credential-rotation-and-git-purge/spec.md`

---

### GAP-23: Timing-unsafe comparison of CRON_SECRET

- **Status**: OPEN (carried from pass #3)
- **Audit passes**: #3, #4
- **Priority**: CRITICAL
- **Severity**: HIGH
- **Complexity**: Low (5-minute fix)
- **Related US**: US-10 (Cron Endpoints Require Authentication)

#### Description

`apps/api/src/cron/middleware.ts:43,51` compares the cron secret using `===` (standard string equality), which is vulnerable to timing attacks. An attacker with network-level control could infer prefixes of the correct secret through response timing differences.

#### Proposed Solutions

1. **Use `timingSafeEqual` from `node:crypto`** (recommended)
2. **Accept as-is** .. if cron endpoints are only called from Vercel's internal cron scheduler

#### Recommendation

Direct fix, no SPEC needed. 5-minute change.

#### Files

- `apps/api/src/cron/middleware.ts:43,51`

---

## HIGH

---

### GAP-02: Staging environment does not exist (SPEC-025)

- **Status**: OPEN (carried from pass #1)
- **Audit passes**: #1, #2, #3, #4
- **Priority**: HIGH
- **Severity**: HIGH
- **Complexity**: High
- **Related Spec Tasks**: T-052 (deferred to SPEC-025)
- **Related US**: Phase 7 verification

#### Description

All user stories from SPEC-019 have only been verified via automated tests, never in a real deployment environment. SPEC-025 is in `draft` status with an empty tasks directory.

#### Recommendation

Requires formal SPEC. Execute SPEC-025 before going public.

---

### GAP-03: Rate limiting TRUST_PROXY default false breaks per-user limits on Vercel

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: HIGH
- **Severity**: HIGH
- **Complexity**: Low (config change)
- **Related US**: US-06 (Rate Limiting Scales Across Instances)

#### Description

`API_RATE_LIMIT_TRUST_PROXY` defaults to `false` (`packages/config/src/env-config-helpers.ts:130`). When false, the rate limiter uses a single bucket `'untrusted-proxy'` for ALL requests (`rate-limit.ts:352`). On Vercel, all users share the same rate limit bucket.

#### Recommendation

Quick fix: set `API_RATE_LIMIT_TRUST_PROXY=true` in Vercel deployment config. No SPEC needed.

#### Files

- `packages/config/src/env-config-helpers.ts:130`
- `apps/api/src/middlewares/rate-limit.ts:350-355`

---

### GAP-04: Subscription webhook updates without database transactions

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: HIGH
- **Severity**: HIGH
- **Complexity**: Medium
- **Related US**: Not in SPEC-019 scope

#### Description

In `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:279-314`, subscription status update and audit log insert are separate, non-transactional operations. The audit log insert silently swallows errors. Intentional design decision, but creates audit trail inconsistency.

#### Recommendation

Add to SPEC-027 (Webhook Subscription Sync).

#### Files

- `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:279-314`

---

### GAP-24: `user.role === 'HOST'` string literal in auth.ts lifecycle hook

- **Status**: OPEN (carried from pass #3)
- **Audit passes**: #3, #4
- **Priority**: HIGH
- **Severity**: HIGH
- **Complexity**: Low (5-minute fix)
- **Related US**: US-14 (Permission Checks Use PermissionEnum Consistently)

#### Description

`apps/api/src/lib/auth.ts:332` uses string literal `'HOST'` to gate trial start for new HOST users. Also at line 309: `role: 'HOST'` sets default role as raw string. If `RoleEnum.HOST` value changes, new HOST users silently do NOT receive trial subscriptions.

#### Recommendation

Direct fix. Use `RoleEnum.HOST` at both line 309 and 332.

#### Files

- `apps/api/src/lib/auth.ts:309,332`

---

### GAP-25: `/health/db` endpoint leaks database error messages and environment

- **Status**: OPEN (carried from pass #3)
- **Audit passes**: #3, #4
- **Priority**: HIGH
- **Severity**: HIGH
- **Complexity**: Low
- **Related US**: US-18 (Error Responses Don't Leak Internal Details)

#### Description

`apps/api/src/routes/health/db-health.ts` is publicly accessible (no auth) and exposes raw database error messages (line 77) that can reveal hostnames, ports, and PostgreSQL driver details. Lines 58,82 expose `environment: process.env.NODE_ENV`.

#### Recommendation

Direct fix. Sanitize error messages and restrict `/health/db` to admin auth.

#### Files

- `apps/api/src/routes/health/db-health.ts:57-58,77,81-82`
- `apps/api/src/routes/health/health.ts:20`

---

### GAP-37: CORS wildcard `*` with credentials enabled allows CSRF from any origin

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: HIGH
- **Severity**: HIGH
- **Complexity**: Low
- **Related US**: US-09 (CORS Wildcard Subdomain Matching)

#### Description

`apps/api/src/middlewares/security.ts:148-149`: if `API_CORS_ORIGINS` contains `*`, `originVerificationMiddleware` approves ALL origins for mutating requests (POST/PUT/PATCH/DELETE). Combined with `API_CORS_ALLOW_CREDENTIALS: true` (default in `env-config-helpers.ts:86`), this violates the CORS spec and enables CSRF from any domain. The CORS spec prohibits `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`.

#### Proposed Solutions

1. **Block wildcard + credentials combination** (recommended) .. add validation in `superRefine` or in the middleware itself
2. **Document as forbidden configuration** .. add warning to env docs
3. **Remove wildcard support entirely** .. only explicit origins allowed

#### Recommendation

Direct fix. Add a startup validation or runtime guard that rejects `*` when credentials are enabled.

#### Files

- `apps/api/src/middlewares/security.ts:148-149`
- `packages/config/src/env-config-helpers.ts:86`

---

### GAP-38: `HOSPEDA_DISABLE_AUTH` and `HOSPEDA_ALLOW_MOCK_ACTOR` lack production guard in env validation

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: HIGH
- **Severity**: HIGH
- **Complexity**: Low (5-minute fix)
- **Related US**: General security hardening

#### Description

`apps/api/src/utils/env.ts:82-84` defines `HOSPEDA_DISABLE_AUTH` and `HOSPEDA_ALLOW_MOCK_ACTOR` as boolean with `default(false)`. The `superRefine` block (lines 272-293) validates `CRON_SECRET` and `REDIS_URL` in production but does NOT validate that these auth-bypass flags are `false` in production. If accidentally set to `true` in Vercel env vars, ALL authentication is bypassed with no startup error.

Runtime guards exist (`actor.ts:43-49` checks `NODE_ENV === 'test'`), but a misconfiguration where `NODE_ENV=test` leaks to production would bypass both protections simultaneously.

#### Proposed Solutions

1. **Add `superRefine` validation** (recommended):
   ```typescript
   if (data.NODE_ENV === 'production' && data.HOSPEDA_DISABLE_AUTH === true) {
       ctx.addIssue({ ... });
   }
   ```
2. **Hardcode the check in the middleware** .. `if (process.env.NODE_ENV === 'production') return false`

#### Recommendation

Direct fix. 5-minute change to add two `superRefine` rules.

#### Files

- `apps/api/src/utils/env.ts:82-84,272-293`

---

### GAP-39: OAuth client secret empty string fallback in auth.ts

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: HIGH
- **Severity**: HIGH
- **Complexity**: Low
- **Related US**: General security hardening

#### Description

`apps/api/src/lib/auth.ts:260,266` uses `|| ''` fallback for Google and Facebook OAuth client secrets:

```typescript
clientSecret: env.HOSPEDA_GOOGLE_CLIENT_SECRET || ''
clientSecret: env.HOSPEDA_FACEBOOK_CLIENT_SECRET || ''
```

If `clientId` is set but `clientSecret` is missing, Better Auth initializes OAuth with an empty secret. Depending on Better Auth's validation, this could cause OAuth to fail silently or, worse, process callbacks without proper server-side verification.

#### Proposed Solutions

1. **Add `superRefine` cross-validation** (recommended) .. require `clientSecret` when `clientId` is set
2. **Remove `|| ''` and let it throw at runtime** .. partial fix

#### Recommendation

Direct fix. Add cross-validation in env schema.

#### Files

- `apps/api/src/lib/auth.ts:260,266`
- `apps/api/src/utils/env.ts` (add superRefine)

---

## MEDIUM

---

### GAP-05: SUPER_ADMIN role bypass in authorization middleware

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-14 (Permission Checks Use PermissionEnum Consistently)

#### Description

Three locations still use direct `actor.role === RoleEnum.SUPER_ADMIN` bypasses:
1. `apps/api/src/middlewares/authorization.ts:52-53`
2. `apps/api/src/middlewares/billing-admin-guard.middleware.ts:85`
3. `packages/service-core/src/utils/permission.ts:120`

These are functionally redundant since SUPER_ADMIN is seeded with all `PermissionEnum` values.

#### Recommendation

Can be fixed directly. Remove role bypasses, rely on permission checks.

---

### GAP-06: JSON-LD vulnerable to stored XSS in Breadcrumb and Propietarios

- **Status**: OPEN (carried from pass #1)
- **Audit passes**: #1, #2, #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM (Breadcrumb is HIGH due to dynamic data, Propietarios is LOW due to static data)
- **Complexity**: Low (5-minute fix)
- **Related US**: US-12 (HTML Output Sanitized Against XSS)

#### Description

Two files use `JSON.stringify()` without escaping `</script>`:
1. `apps/web/src/components/shared/Breadcrumb.astro:114` .. dynamic API data (HIGH risk)
2. `apps/web/src/pages/[lang]/propietarios/index.astro:96` .. static module data (LOW risk)

Fix exists in `JsonLd.astro:22`: `.replace(/</g, '\\u003c')`.

#### Recommendation

Direct fix. Use `<JsonLd>` component or apply the escape pattern.

#### Files

- `apps/web/src/components/shared/Breadcrumb.astro:114`
- `apps/web/src/pages/[lang]/propietarios/index.astro:96`

---

### GAP-07: Env var name mismatch for super admin password

- **Status**: OPEN (carried from pass #1)
- **Audit passes**: #1, #2, #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-03 (Super Admin Credentials)

#### Description

Code reads `process.env.SEED_SUPER_ADMIN_PASSWORD` (`superAdminLoader.ts:53`) but registry and docs use `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD`. An operator following docs configures the wrong name; the seed silently generates a random password.

#### Recommendation

Direct fix. Change code to read `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD`.

---

### GAP-08: Entitlements billing ownership always denied (functional bug)

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Medium
- **Related US**: US-04 (Billing IDOR Protection)

#### Description

`billing-ownership.middleware.ts:104-108`: the `entitlements` case always returns `null`, denying access to ALL users including the resource owner. No warning log is emitted when this happens.

#### Recommendation

Verify if any frontend calls `GET /entitlements/:id`. If not, document and defer. If yes, implement lookup.

---

### GAP-11: Sensitive billing data logged without masking

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Medium
- **Related US**: Not in SPEC-019 scope

#### Description

`subscription-logic.ts:196-199,284-293` logs MercadoPago preapproval IDs and status transitions without masking.

#### Recommendation

Address as part of a broader logging policy.

---

### GAP-12: CI dependency audit doesn't block pipeline

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-01 (Dependency Vulnerabilities Resolved)

#### Description

`.github/workflows/ci.yml:63-69` runs `pnpm audit` with `continue-on-error: true` and `|| true`. Critical CVEs in production dependencies do NOT block the CI pipeline or prevent deploys.

#### Recommendation

Direct fix. Remove `continue-on-error: true` for the critical/high step.

---

### GAP-14: Billing and reports routes outside three-tier architecture

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: High (breaking change)
- **Related US**: US-11 (Exchange Rate Routes Under Correct Tier)

#### Description

QZPay-provided billing routes at `/api/v1/billing/*`, reports at `/api/v1/reports/*`, and cron at `/api/v1/cron` exist outside the tiered architecture. These have their own middleware chains. Pass #4 confirmed this is an intentional design decision.

#### Recommendation

Document the exception. Moving routes would be a breaking change.

---

### GAP-27: `canCreateBookmark` lacks admin bypass

- **Status**: OPEN (carried from pass #3, **reclassified in pass #4**)
- **Audit passes**: #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-14 (Permission Checks)

#### Description

Pass #3 analyzed the `||` vs `&&` logic and concluded it was correct but confusing. Pass #4 identified the deeper issue: `canAccessBookmark` (line 11-19) has NO admin bypass. ADMIN/SUPER_ADMIN with all permissions cannot view or manage any user's bookmarks through the service layer. Support staff cannot inspect corrupted bookmarks without direct DB access.

#### Proposed Solutions

1. **Add permission-based admin bypass** (recommended) .. check `PermissionEnum.USER_BOOKMARK_MANAGE_ANY` or similar
2. **Document as intentional privacy-by-design** .. if favorites should never be admin-visible

#### Files

- `packages/service-core/src/services/userBookmark/userBookmark.permissions.ts:11-19,29`

---

### GAP-28: Route params without UUID validation in accommodation routes

- **Status**: OPEN (carried from pass #3)
- **Audit passes**: #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: Not in SPEC-019 scope

#### Description

Three routes use `c.req.param()` without Zod UUID validation:
1. `apps/api/src/routes/accommodation/protected/getFaqs.ts:24`
2. `apps/api/src/routes/accommodation/public/getByDestination.ts:24`
3. `apps/api/src/routes/accommodation/public/getTopRatedByDestination.ts:24`

#### Recommendation

Direct fix. Add `requestParams` with `z.string().uuid()`.

---

### GAP-29: PII logged at INFO level in contact form

- **Status**: OPEN (carried from pass #3)
- **Audit passes**: #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: Not in SPEC-019 scope

#### Description

`apps/api/src/routes/contact/submit.ts:42-52` logs `firstName`, `lastName`, and `email` at INFO level.

#### Recommendation

Direct fix. Remove PII fields from the log call, keep only `contactType`, `accommodationId`, `messageLength`, `emailDomain`.

---

### GAP-30: X-Forwarded-For trusted for rate limit clearing without auth

- **Status**: OPEN (carried from pass #3)
- **Audit passes**: #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-06 (Rate Limiting)

#### Description

`apps/api/src/routes/auth/signout.ts:19` has `skipAuth: true` and lines 35-38 use `x-forwarded-for` to determine client IP, then calls `clearRateLimitForIp`. An unauthenticated attacker can spoof the header to clear rate limits for any IP before brute-force attacks.

#### Recommendation

Direct fix. Only clear rate limit when user is authenticated.

---

### GAP-31: In-memory Map in serverless webhook event handler

- **Status**: OPEN (carried from pass #3, **partially mitigated**)
- **Audit passes**: #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Medium
- **Related US**: Not in SPEC-019 scope

#### Description

`event-handler.ts:25` uses a module-level `Map`. Pass #4 found that `webhookEventIds` in `utils.ts:22` is marked `@deprecated` but still exported from `index.ts:13`. The new `requestProviderEventIds` Map is used only to correlate `onEvent`/`onError` within a single request, which is safe. However, the deprecated Map should be removed.

#### Recommendation

Remove deprecated `webhookEventIds` export. Address in SPEC-027.

---

### GAP-32: Orphan exchange-rate files with write operations in protected tier

- **Status**: OPEN (carried from pass #3)
- **Audit passes**: #3, #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low (delete dead code)
- **Related US**: US-11 (Exchange Rate Routes Under Correct Tier)

#### Description

4 files in `apps/api/src/routes/exchange-rates/protected/` implement write operations using `createProtectedRoute` but are NOT mounted. Dead code that poses a risk if accidentally re-mounted (admin operations accessible with only user auth).

#### Recommendation

Direct fix. Delete the 4 orphan files.

---

### GAP-33: Direct role checks in billing promo-codes routes

- **Status**: OPEN (carried from pass #3)
- **Audit passes**: #3, #4
- **Priority**: MEDIUM (upgraded from LOW)
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-14 (Permission Checks Use PermissionEnum Consistently)

#### Description

`apps/api/src/routes/billing/promo-codes.ts:229-234` and `:280-285` use `actor.role !== RoleEnum.ADMIN && actor.role !== RoleEnum.SUPER_ADMIN`. Pass #4 also notes these throw `new Error()` instead of `HTTPException`, potentially causing 500 instead of 403.

#### Recommendation

Direct fix. Replace with `actor.permissions?.includes(PermissionEnum.BILLING_ADMIN)` and throw `HTTPException(403)`.

---

### GAP-40: `HOSPEDA_BETTER_AUTH_SECRET` validated with `min(1)` instead of `min(32)`

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low (5-minute fix)
- **Related US**: General security hardening

#### Description

`apps/api/src/utils/env.ts:66`: `HOSPEDA_BETTER_AUTH_SECRET: z.string().min(1, ...)`. A secret of 6 characters would pass validation. Better Auth recommends >= 32 characters for secure session signing.

#### Recommendation

Direct fix. Change to `min(32, 'Better Auth secret must be at least 32 characters')`.

#### Files

- `apps/api/src/utils/env.ts:66`

---

### GAP-41: Header sanitization in validation middleware has no effect

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Medium
- **Related US**: US-13 (Request Body Size)

#### Description

`apps/api/src/middlewares/validation.ts:107-111`: `Object.assign(c.req.raw.headers, sanitizedHeaders)` attempts to sanitize headers, but `c.req.raw.headers` is a Web API `Headers` object. `Object.assign` on it does NOT update the actual headers. Route handlers via `c.req.header()` receive unsanitized values. This gives a false sense of security.

#### Proposed Solutions

1. **Remove the dead code** (recommended) .. if header sanitization isn't needed, don't pretend it works
2. **Reconstruct the Request** .. build a new Request with sanitized headers (expensive)
3. **Document as audit-only** .. clarify it's for logging, not actual sanitization

#### Files

- `apps/api/src/middlewares/validation.ts:107-111`

---

### GAP-42: Query param sanitization in validation middleware has no effect

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Medium
- **Related US**: US-13

#### Description

`apps/api/src/middlewares/validation.ts:115-125`: `Object.defineProperty(c.req, 'url', ...)` overwrites the URL string on the Hono wrapper, but `c.req.query()` and `c.req.queries()` read from the internal `Request` object (`c.req.raw`), not the overwritten property. Route handlers receive unsanitized query params.

#### Proposed Solutions

1. **Remove dead code** (recommended) .. Zod validation on route handlers is the real protection
2. **Replace raw Request** .. if sanitization is truly needed at middleware level

#### Files

- `apps/api/src/middlewares/validation.ts:115-125`

---

### GAP-43: `getEndpointType()` uses `path.includes()` for rate limit bucket classification

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-06 (Rate Limiting)

#### Description

`apps/api/src/middlewares/rate-limit.ts:233-244`: the function checks `path.includes('/auth/')`, then `path.includes('/admin/')`, then `path.includes('/public/')`. A path like `/api/v1/admin/something/auth/reset` classifies as `'auth'` (50 req/5min) instead of `'admin'` (200 req/10min). An attacker could construct paths to get a more favorable rate limit bucket.

#### Proposed Solutions

1. **Use `path.startsWith()` with base prefix** (recommended) .. `path.startsWith('/api/v1/admin/')`
2. **Extract the tier from the first path segment after `/api/v1/`**

#### Files

- `apps/api/src/middlewares/rate-limit.ts:233-244`

---

### GAP-44: `/auth/me` exposes full permission set to all authenticated users

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-16 (/auth/me Endpoint)

#### Description

`apps/api/src/routes/auth/me.ts:26`: `const filteredActor = actor` returns the complete permission array to any authenticated user. A malicious user can enumerate all system permissions, potentially discovering undisclosed features or admin capabilities.

The comment justifies this as needed for "client-side feature gating", but regular users only need a subset (e.g., `ACCESS_*` permissions).

#### Proposed Solutions

1. **Filter permissions by role** (recommended) .. admin users get full list, regular users get only `ACCESS_*` permissions
2. **Document as accepted risk** .. if client-side gating requires full visibility
3. **Create a separate admin-only endpoint** for full permission enumeration

#### Files

- `apps/api/src/routes/auth/me.ts:26`

---

### GAP-45: Content-Security-Policy absent from Web and Admin vercel.json

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Medium (requires production bundle analysis)
- **Related US**: US-12 (HTML Output Sanitized Against XSS)

#### Description

`apps/web/vercel.json` and `apps/admin/vercel.json` define X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, but NO Content-Security-Policy header. The API has CSP via Hono middleware, but Web (with `set:html`) and Admin (with `dangerouslySetInnerHTML`) lack this defense-in-depth layer.

#### Recommendation

Requires analysis of production bundles to determine inline script requirements. Consider for a dedicated security SPEC.

---

### GAP-46: Super admin generated password logged in plaintext to stdout

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-03 (Super Admin Credentials)

#### Description

`packages/seed/src/utils/superAdminLoader.ts:59`: `logger.info('Generated password: ${password}')`. In containerized/cloud environments, stdout is shipped to log aggregation (CloudWatch, Datadog, Sentry). A credential appearing in logs violates security hygiene and may trigger compliance violations.

#### Proposed Solutions

1. **Write to a temporary file with restricted permissions** (recommended)
2. **Require the env var in all environments** .. no fallback generation
3. **Print only once to stderr** .. less likely to be captured by log aggregators

#### Files

- `packages/seed/src/utils/superAdminLoader.ts:59`

---

### GAP-47: UserBookmark `_canList`/`_canSearch`/`_canCount` allows any authenticated user

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Medium
- **Related US**: Not in SPEC-019 scope

#### Description

`packages/service-core/src/services/userBookmark/userBookmark.service.ts:83-90`: These permission checks only verify the actor is not null. Any authenticated user can list, search, and count ALL bookmarks for any entity without ownership verification. Combined with `listBookmarksByEntity` (which returns actual bookmark records including `userId`), this leaks bookmark data and user IDs across users.

#### Proposed Solutions

1. **Filter results by actor's userId** (recommended) .. return only the requesting user's bookmarks
2. **Add permission requirement** .. `PermissionEnum.USER_BOOKMARK_LIST`
3. **Accept as-is** .. if bookmark counts are intended to be public

#### Files

- `packages/service-core/src/services/userBookmark/userBookmark.service.ts:83-90`

---

### GAP-48: `createSystemActor()` lacks runtime guard against HTTP context injection

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: General security hardening

#### Description

`apps/api/src/utils/actor.ts:32-36`: `createSystemActor()` returns an actor with `role: RoleEnum.SUPER_ADMIN` and all `PermissionEnum` values. The comment says "NEVER expose this actor to user-facing code" but there is no `isSystemActor()` utility or runtime guard in `authorizationMiddleware` to prevent accidental injection into HTTP request context.

#### Proposed Solutions

1. **Add `isSystemActor()` check** in authorization middleware (recommended) .. block system actors from serving HTTP requests
2. **Add a `system: true` flag** to the actor object .. explicit discrimination

#### Files

- `apps/api/src/utils/actor.ts:32-36`

---

### GAP-49: Billing ownership middleware fail-open for unknown resource types

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-04 (Billing IDOR Protection)

#### Description

`apps/api/src/middlewares/billing-ownership.middleware.ts:241-243`: unknown resource types pass through without ownership verification. If a new billing resource (e.g., `credits`, `vouchers`) is added without updating `DIRECT_CUSTOMER_RESOURCES` or `LOOKUP_RESOURCES`, the middleware silently allows unverified access.

#### Proposed Solutions

1. **Change default to fail-closed** (recommended) .. return 403 for unknown resource types with IDs
2. **Log a warning** for unknown types

#### Files

- `apps/api/src/middlewares/billing-ownership.middleware.ts:241-243`

---

### GAP-50: `/health` endpoint registered before middleware stack (no rate limiting)

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: General security hardening

#### Description

`apps/api/src/utils/create-app.ts:89`: a `/health` handler is registered BEFORE any middleware, bypassing rate limiting, security headers, CORS, and logging. This creates a duplicate handler (the route-level health handler has a rate limit). An attacker can flood this endpoint without limit.

#### Proposed Solutions

1. **Move after middleware** (recommended) .. or apply inline rate limiting
2. **Remove it** .. the route-level health handler is sufficient

#### Files

- `apps/api/src/utils/create-app.ts:89`

---

### GAP-51: SUPER_ADMIN bypass without audit logging in billing admin guard

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-14

#### Description

`apps/api/src/middlewares/billing-admin-guard.middleware.ts:85,156`: when SUPER_ADMIN bypasses the guard, no audit log is emitted. Destructive billing operations (DELETE, refunds) by SUPER_ADMIN are invisible in security logs.

#### Recommendation

Direct fix. Add `logger.info()` when SUPER_ADMIN bypass is used.

---

### GAP-52: `Math.random()` in shared `randomString()` utility

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: General security hardening

#### Description

`packages/utils/src/string.ts:133-143`: `randomString()` uses `Math.random()` which is not cryptographically secure. This utility is shared across the monorepo. If any consumer uses it for tokens, codes, or security-relevant strings, the output is predictable.

#### Proposed Solutions

1. **Replace with `crypto.getRandomValues()`** (recommended)
2. **Add a JSDoc warning** .. `@warning Not suitable for security-sensitive values`
3. **Create a separate `secureRandomString()`** .. using `node:crypto`

#### Files

- `packages/utils/src/string.ts:133-143`

---

### GAP-53: Cron env var names wrong throughout documentation

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-10 (Cron Endpoints)

#### Description

`apps/api/docs/cron-system.md` uses unprefixed names `CRON_SECRET` and `CRON_ADAPTER` throughout (lines 108, 129, 158, 200, 260, 1340-1344). The code uses `HOSPEDA_CRON_SECRET` and `HOSPEDA_CRON_ADAPTER` (`env.ts:249-251`). A developer following the docs will configure wrong variable names, causing silent failures.

#### Recommendation

Direct fix. Replace all occurrences with `HOSPEDA_*` prefixed names.

---

### GAP-54: Undocumented cron jobs in vercel.json

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: US-10 (Cron Endpoints)

#### Description

`apps/api/vercel.json` registers 6 cron jobs but `apps/api/docs/cron-system.md` only documents 4. Missing: `exchange-rate-fetch` and `dunning`. Undocumented production jobs are an operational and audit risk.

#### Recommendation

Direct fix. Document the missing jobs.

#### Files

- `apps/api/vercel.json:47-56`
- `apps/api/docs/cron-system.md` (Registered Jobs section)

---

### GAP-55: `refresh-search.yml` uses legacy `DATABASE_URL` and Node.js 18

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: MEDIUM
- **Severity**: MEDIUM
- **Complexity**: Low
- **Related US**: Not in SPEC-019 scope

#### Description

`.github/workflows/refresh-search.yml:13` uses `DATABASE_URL` instead of `HOSPEDA_DATABASE_URL`. Line 26 uses Node.js 18 (EOL April 2025). All other workflows use Node 20 and `HOSPEDA_*` prefix.

#### Recommendation

Direct fix. Update env var name and Node version.

---

## LOW

---

### GAP-15: CRON_AUTH_DISABLED still documented as active feature

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: LOW
- **Complexity**: Low

#### Description

`apps/api/docs/cron-system.md` (7 locations) documents `CRON_AUTH_DISABLED` which was removed from code. Misleading.

#### Recommendation

Direct fix. Remove all references.

---

### GAP-16: `actor.role !== 'GUEST'` uses string literal instead of enum

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: LOW
- **Complexity**: Low

#### Description

`apps/api/src/routes/auth/me.ts:21`. Use `!isGuestActor(actor)` instead.

---

### GAP-17: Dead code and Spanish comments in userBookmark.permissions.ts

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: LOW
- **Complexity**: Low

#### Description

Commented-out code (line 13), Spanish JSDoc comments (lines 6-8, 23-25). Violates English-only policy.

---

### GAP-18: SEC-ID labels absent from ACCEPTED_RISKS.md

- **Status**: OPEN (carried from pass #1)
- **Audit passes**: #1, #2, #3, #4
- **Priority**: LOW
- **Complexity**: Low

#### Description

11 risks without SEC-ID cross-references. Non-sequential numbering (5,7,8,6,9,11,10).

---

### GAP-19: CORS documentation mentions removed headers

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: LOW
- **Complexity**: Low

#### Description

`apps/api/docs/cors-configuration.md:40,119-121` lists `x-actor-id` and `x-user-id` which no longer exist in code.

---

### GAP-35: NODE_ENV disclosed in public health responses

- **Status**: OPEN (carried from pass #3)
- **Audit passes**: #3, #4
- **Priority**: LOW
- **Complexity**: Low

#### Description

`health.ts:20` and `db-health.ts:58,82` expose `environment` field. Combine fix with GAP-25.

---

### GAP-36: `console.error`/`console.warn` instead of structured logger

- **Status**: OPEN (carried from pass #3, **expanded in pass #4**)
- **Audit passes**: #3, #4
- **Priority**: LOW
- **Complexity**: Low

#### Description

Pass #4 found an additional instance: `apps/api/src/middlewares/past-due-grace.middleware.ts:29-33` uses `console.warn`. Original: `apps/api/src/lib/auth.ts:404` uses `console.error`.

---

### GAP-56: `Math.random()` in `generateRequestId()`

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`apps/api/src/utils/request-id.ts:9`: request IDs use `Math.random()`. Not a security credential but IDs are exposed in `X-Request-ID` headers and error responses, making them predictable.

#### Recommendation

Direct fix. Use `crypto.randomUUID()`.

---

### GAP-57: Documentation examples use forbidden role-check patterns

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

Multiple doc example files contain `actor.role !== RoleEnum.ADMIN` patterns that are explicitly prohibited by `service-core/CLAUDE.md`:
- `packages/service-core/docs/examples/basic-service.ts:83,97,111,125,139`
- `packages/service-core/docs/examples/custom-methods.ts:55,63,67,72`
- `packages/service-core/docs/examples/complex-logic.ts:117,121,125`
- `packages/service-core/docs/examples/with-hooks.ts:92,102,108,116`
- `apps/api/docs/examples/complex-logic.ts:185`

Developers copy from examples, normalizing the forbidden pattern.

#### Recommendation

Direct fix. Update examples to use `PermissionEnum`.

---

### GAP-58: `file.name` reflected in error messages without sanitization

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`apps/api/src/routes/reports/create-report.ts:118,131,155` and `apps/api/src/routes/feedback/submit.ts:292` reflect client-provided `file.name` in JSON error responses. If a frontend renders these messages as HTML without escaping, XSS is possible.

#### Recommendation

Direct fix. Use generic messages or sanitize the name.

---

### GAP-59: `console.warn` in past-due-grace middleware (module-level)

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`apps/api/src/middlewares/past-due-grace.middleware.ts:29-33` uses `console.warn` at module import time. Merged conceptually with GAP-36.

---

### GAP-60: Stack trace logged without type guard in webhook event-handler

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`apps/api/src/routes/webhooks/mercadopago/event-handler.ts:223-230`: `stack: error.stack` accessed without `error instanceof Error` guard. Inconsistent with other error logging patterns in the codebase.

---

### GAP-61: billing-usage error message propagated to API response

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`apps/api/src/services/billing-usage.service.ts:155`: `error.message` from Postgres (which may contain table names, permissions) is returned in the error `Result<T>` to admin clients. The global error handler's `hideDetails` doesn't apply because this is a business-layer result, not an HTTP exception.

#### Recommendation

Direct fix. Return generic message: `'Failed to get system usage stats'`.

---

### GAP-62: Contact form endpoint lacks specific rate limiting

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`apps/api/src/routes/contact/submit.ts` uses `createSimpleRoute` without `customRateLimit`. The global rate limit (100 req/window) applies but a public endpoint that sends notifications should have a tighter limit (e.g., 5 req/min).

---

### GAP-63: `docs.yml` uses `pnpm/action-setup@v2` (outdated)

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`.github/workflows/docs.yml:34,59,80` uses `pnpm/action-setup@v2` while `ci.yml` uses `@v4`. Also hardcodes `version: 9` instead of reading from `packageManager` field.

---

### GAP-64: `engines.node` allows EOL Node.js 18

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`package.json:77`: `"node": ">=18"`. Node 18 reached EOL in April 2025. Should require `>=20`.

---

### GAP-65: Cron webhook-retry schedule mismatch in documentation

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`apps/api/docs/cron-system.md:782` says `webhook-retry` runs hourly (`0 */1 * * *`). `apps/api/vercel.json:49` has it at `0 3 * * *` (daily at 3 AM UTC).

---

### GAP-66: `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` docs don't warn about plaintext logging

- **Status**: NEW (pass #4)
- **Audit passes**: #4
- **Priority**: LOW
- **Severity**: LOW
- **Complexity**: Low

#### Description

`docs/guides/environment-variables.md:65` describes the variable but doesn't mention that when absent, the generated password is printed to stdout, which may appear in CI logs.

---

## INFORMATIONAL

---

### GAP-20: Redis fallback degrades silently without logging

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: INFORMATIONAL

#### Description

`rate-limit.ts:101,115,126,153,179`: empty `catch {}` blocks. System degrades to in-memory without any log.

---

### GAP-21: POST /metrics/reset accessible to all admins

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: INFORMATIONAL

#### Description

`POST /api/v1/admin/metrics/reset` has no specific permission or env guard. Any admin can reset all metrics. Spec US-05 requires `METRICS_RESET` permission.

---

### GAP-22: Exchange rate tier duplication

- **Status**: OPEN (carried from pass #2)
- **Audit passes**: #2, #3, #4
- **Priority**: INFORMATIONAL

#### Description

Protected tier exposes read-only exchange rate operations that duplicate admin tier. Functionally acceptable.

---

## Cross-Reference: Work Delegated to Other Specs

| Gap | Delegated To | Spec Status | Tasks Created | Urgency |
|-----|-------------|-------------|---------------|---------|
| GAP-01: Credential rotation | SPEC-024 | draft | NO | CRITICAL - do before launch |
| GAP-02: Staging verification | SPEC-025 | draft | NO | HIGH - do before launch |
| GAP-04: Webhook transactions | SPEC-027 | pending | YES (20 tasks, 0%) | HIGH - add as task |
| GAP-31: Serverless Map cleanup | SPEC-027 | pending | NO | MEDIUM |
| GAP-45: CSP headers | New SPEC needed | - | NO | MEDIUM |

---

## Recommended Execution Order

### Before Launch (Blockers)

1. **SPEC-024** (credential rotation) .. CRITICAL, production credentials exposed
2. **GAP-23** Timing-safe CRON_SECRET comparison .. 5 min fix
3. **GAP-38** DISABLE_AUTH/ALLOW_MOCK_ACTOR superRefine guard .. 5 min fix
4. **GAP-39** OAuth client secret empty fallback .. 10 min fix
5. **GAP-37** CORS wildcard + credentials validation .. 10 min fix
6. **GAP-06** Breadcrumb + Propietarios XSS fix .. 5 min fix
7. **GAP-24** `user.role === 'HOST'` enum fix .. 5 min fix
8. **GAP-25** Health endpoint info leak fix .. 15 min fix
9. **GAP-03** TRUST_PROXY env var .. config change
10. **GAP-07** Env var name mismatch .. 5 min fix
11. **GAP-30** Signout rate limit clearing fix .. 10 min fix
12. **GAP-40** BETTER_AUTH_SECRET min(32) .. 5 min fix
13. **SPEC-025** (staging environment) .. validate all controls end-to-end

### Quick Wins (Direct fixes, < 30 min each)

14. **GAP-12** CI audit blocking
15. **GAP-32** Delete orphan exchange-rate files
16. **GAP-33** Promo-codes permission checks + HTTPException
17. **GAP-16** String literal enum fix in auth/me
18. **GAP-29** PII in contact form logs
19. **GAP-46** Super admin password logging
20. **GAP-49** Billing ownership fail-closed for unknown types
21. **GAP-50** /health middleware bypass
22. **GAP-43** Rate limit path classification
23. **GAP-52** Math.random() in randomString
24. **GAP-15** CRON_AUTH_DISABLED docs cleanup
25. **GAP-53** Cron env var names in docs
26. **GAP-19** CORS docs update
27. **GAP-20** Redis fallback logging
28. **GAP-17** Bookmark dead code + Spanish comments
29. **GAP-35** NODE_ENV in health responses
30. **GAP-36** console.error/warn to structured logger
31. **GAP-55** refresh-search.yml fixes
32. **GAP-56** Math.random in requestId
33. **GAP-57** Doc examples with forbidden patterns
34. **GAP-58** file.name in error messages
35. **GAP-61** billing-usage error propagation

### Medium Effort (1-2 hours)

36. **GAP-05** SUPER_ADMIN role bypasses (3 files)
37. **GAP-28** Route params UUID validation (3 routes)
38. **GAP-41** Header sanitization dead code removal
39. **GAP-42** Query sanitization dead code removal
40. **GAP-44** /auth/me permission filtering
41. **GAP-47** UserBookmark list/search access control
42. **GAP-48** createSystemActor runtime guard
43. **GAP-51** SUPER_ADMIN audit logging
44. **GAP-08** Entitlements ownership (verify frontend first)
45. **GAP-18** ACCEPTED_RISKS renumbering + SEC-IDs
46. **GAP-54** Document undocumented cron jobs
47. **GAP-21** Metrics reset permission

### Deferred (Address in dedicated SPECs)

48. **GAP-01** Credential rotation .. SPEC-024
49. **GAP-02** Staging environment .. SPEC-025
50. **GAP-04** Webhook transactions .. add to SPEC-027
51. **GAP-45** CSP headers .. new SPEC or SPEC-022
52. **GAP-11** Logging masking .. new logging policy SPEC
53. **GAP-14** Route tier restructuring .. breaking change, future SPEC
54. **GAP-22** Exchange rate tier cleanup .. future architecture SPEC
55. **GAP-27** UserBookmark admin bypass .. pending design decision

---

## Appendix A: Items NOT in SPEC-019 Found During Audit

| Item | Severity | Where to Track |
|------|----------|----------------|
| Markdown parser in admin relies solely on DOMPurify | MEDIUM | SPEC-022 |
| Webhook signature header not verified against MP docs | MEDIUM | SPEC-027 |
| `userId` field in public feedback endpoint not validated | LOW | Direct fix |
| Linear label IDs without format validation | LOW | Direct fix |
| `users.seed.ts:47` uses string literal `'SUPER_ADMIN'` | LOW | Direct fix |
| Test setup files use direct role checks (normalized pattern) | LOW | Cleanup task |
| `docs.yml` outdated pnpm action version | LOW | GAP-63 |
| Node 18 EOL in engines.node | LOW | GAP-64 |
| Cron schedule mismatch in docs | LOW | GAP-65 |
| `skipLibCheck: true` in root tsconfig | INFORMATIONAL | Accepted |

---

## Appendix B: Confirmed RESOLVED Items (All Passes)

| Item | When Resolved | How Verified |
|------|---------------|-------------|
| metricsRoutes no admin auth | Pass #2 | `adminAuthMiddleware()` at `metrics/index.ts:118` |
| Admin route guard role whitelist | Pass #2 | Uses `PermissionEnum.ACCESS_PANEL_ADMIN` at `_authed.tsx:73` |
| Swagger/Scalar docs in production | Pass #2 | `NODE_ENV !== 'production'` guard at `routes/index.ts:250-256` |
| ACCEPTED_RISKS #9 description | Pass #2 | Commit `8bfb8f13` |
| sanitizeHtml SVG use href | Pass #2 | Commit `5c0cc843` |
| Months validation inconsistency | Pass #2 | `Math.min(24, ...)` at `billing-metrics.service.ts:319` |
| In-memory rate limit on serverless | Pass #2 | Redis required in production, `env.ts:283-293` |
| Mock actor bypass risk | Pass #3 | Triple barrier at `actor.ts:43-49` |
| /docs/openapi.json in production | Pass #3 | `configureOpenAPI` only in non-production at `app.ts:12-14` |
| sql.raw() eliminated | Pass #3 | No occurrences in production code |
| x-actor-id/x-user-id CORS removed | Pass #3 | Absent from `env.ts:119` defaults |
| bodyLimit replaces Content-Length | Pass #3 | Stream-level bodyLimit in `create-app.ts:106-128` |
| CRON_AUTH_DISABLED removed | Pass #3 | Not in `cron/middleware.ts` source |
| accommodation.permissions.ts clean | Pass #3 | Only PermissionEnum checks |
| post.permissions.ts clean | Pass #3 | Only PermissionEnum checks |
| HTTPS enforcement | Pass #3 | HSTS with preload in all `vercel.json` files |
| Admin billing routes correct | Pass #3 | `createAdminRoute` with `BILLING_READ_ALL` permission |
| GAP-09: createErrorResponse filtering | Pass #4 | `hideDetails` logic at `response.ts:344-348` |
| GAP-26: TOCTOU in promo code | Pass #4 | `SELECT FOR UPDATE` inside transaction mitigates |
| GAP-34: Dead-letter limit/offset | Pass #4 | Validated via `AdminSearchBaseSchema` with `.max(100)` |

---

## Audit Confidence Level

| Area | Confidence | Notes |
|------|-----------|-------|
| Permission system (US-14) | HIGH | Exhaustive grep of all role checks across entire codebase (6 agents) |
| IDOR protection (US-04) | HIGH | All billing routes reviewed with ownership middleware + fail-open analysis |
| XSS sanitization (US-12) | HIGH | All 8 `set:html` usages verified, JSON-LD escaping checked |
| Rate limiting (US-06) | HIGH | Full implementation review including Redis, path classification, trust proxy |
| Dependencies (US-01) | HIGH | Versions verified, CI audit step analyzed |
| Cron auth (US-10) | HIGH | Middleware reviewed, timing attack found, docs audited |
| Error filtering (US-18) | HIGH | Global handler + formatErrorResponse + billing-usage propagation |
| Docs in production (US-08) | HIGH | Both UI routes and OpenAPI JSON confirmed blocked |
| Auth/session (US-15, US-16) | HIGH | Admin guard, auth/me, OAuth secrets, DISABLE_AUTH flags |
| Route architecture | HIGH | Complete route map with all mount points + parameter validation |
| Middleware effectiveness | HIGH | Header sanitization no-op and query sanitization no-op discovered |
| Anti-patterns (injection, crypto, info disclosure) | HIGH | 12 categories scanned exhaustively by dedicated agent |
| CI/CD security | HIGH | All workflow files analyzed, supply chain issues found |
| Infrastructure (Vercel) | HIGH | All vercel.json files reviewed for headers |
| Documentation accuracy | HIGH | 4 doc files cross-referenced against code |
