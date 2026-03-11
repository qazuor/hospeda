---
spec-id: SPEC-026
title: Security Testing Gaps
type: security
complexity: medium-high
status: completed
created: 2026-03-03T00:00:00.000Z
revised: 2026-03-10T00:00:00.000Z
approved: 2026-03-06T00:00:00.000Z
completed: 2026-03-10T00:00:00.000Z
related-specs:
  - SPEC-019
---

## SPEC-026: Security Testing Gaps

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Close the security testing gaps identified during the exhaustive SPEC-019 audit. While SPEC-019 hardened the application code itself, several categories of security behavior lack automated test coverage. This spec adds tests for existing security mechanisms and implements new protective mechanisms for: webhook route security verification, brute-force / account lockout protection, structured audit logging for security-sensitive operations, and session invalidation test coverage.

#### Motivation

The SPEC-019 post-mortem audit revealed that the application has strong middleware-level security (auth, authorization, IDOR prevention, rate limiting, sanitization) but lacks automated verification and some protective mechanisms:

1. **Webhook route security**: MercadoPago webhook signature verification is delegated to the external `@qazuor/qzpay-mercadopago` library via `createWebhookRouter()`. There are zero integration tests verifying that the full webhook route correctly rejects invalid signatures, handles replay attacks, or processes idempotent requests. Existing tests only cover DB persistence and idempotency utilities in isolation.
2. **Brute-force protection**: Rate limiting exists per-IP (50 requests/5min for auth endpoints) but there is no account-level lockout after N failed login attempts for the same email. Credential stuffing attacks can try thousands of passwords against one account from different IPs.
3. **Audit logging**: Permission denials are logged at WARN level via `apiLogger.warn()` in `authorization.ts`. There is no structured, dedicated audit trail with consistent event schemas for security-sensitive operations (admin billing mutations, permission changes, failed auth attempts).
4. **Session invalidation test coverage**: Better Auth ALREADY handles server-side session deletion correctly via `POST /api/auth/sign-out` (deletes session from PostgreSQL `session` table and clears the cookie). However, there are ZERO automated tests verifying this behavior. A regression in Better Auth or in the Hospeda signout cleanup route (`POST /api/v1/auth/signout`) would go undetected.

#### Success Metrics

- Webhook route has integration tests covering: valid request processed, invalid/missing signature rejected, stale timestamp rejected, duplicate `providerEventId` handled idempotently
- Failed login attempts beyond threshold trigger a temporary account lockout (configurable, default 5 attempts / 15 min)
- Security-sensitive operations produce structured audit log entries with consistent schema, written to a dedicated `AUDIT` logger category
- Session invalidation has integration tests verifying: signout deletes DB session, old token rejected, cookie cleared, rate limits cleared
- All new tests pass in CI with zero regressions

#### Target Users

- **Platform operators**: Confidence that webhook integrations and auth flows are tested
- **Security auditors**: Structured audit trail for compliance reviews
- **End users**: Protection against account takeover via brute force

---

### 2. User Stories & Acceptance Criteria

#### US-01: Webhook Route Security Is Tested

**As a** platform operator,
**I want** automated tests verifying that the MercadoPago webhook route correctly handles signature validation, replay attacks, and idempotency,
**so that** a code change cannot silently break payment notification security.

**Background - How webhooks work in this codebase:**

- Signature verification is handled by the external `@qazuor/qzpay-mercadopago` library, NOT by code in this repo
- The webhook route is created via `createWebhookRouter()` from `@qazuor/qzpay-hono` (configured in `apps/api/src/routes/webhooks/mercadopago/router.ts`)
- The `x-signature` header format is: `ts=<unix-timestamp>,v1=<hmac-sha256-hex>`
- The signing secret is `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` (required in production, optional in sandbox)
- Idempotency is based on `providerEventId` (MercadoPago's numeric event ID extracted as `String(event.id)`), NOT `x-request-id`
- Idempotency is stored in the `billingWebhookEvents` DB table with status tracking (`pending` -> `processed` | `failed`). Uses optimistic locking: INSERT first, handle duplicate on conflict. On duplicate, retries status check up to 3 times with 50ms delays
- The webhook always returns HTTP 200 to MercadoPago, even on processing errors (intentional.. prevents MercadoPago from retrying non-recoverable errors)

**Acceptance Criteria:**

- **AC-01**: **Given** a webhook POST to `/api/v1/webhooks/mercadopago` with a valid `x-signature` header (correct HMAC-SHA256 computed with the configured `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` and matching `ts` value), **When** the route processes the request, **Then** it returns HTTP 200 and the event is persisted in `billingWebhookEvents` with status `processed`
- **AC-02**: **Given** a webhook POST with an invalid `x-signature` header (wrong HMAC value), **When** the route processes the request, **Then** QZPay rejects the request and the route returns HTTP 401 (or the status code QZPay uses for rejection). The event is NOT persisted in `billingWebhookEvents`
- **AC-03**: **Given** a webhook POST without any `x-signature` header, **When** the route processes the request, **Then** the route returns a non-200 error status. The event is NOT persisted
- **AC-04**: **Given** a webhook POST with a valid signature but a `ts` timestamp older than the allowed replay window, **When** the route processes the request, **Then** the request is rejected as a potential replay attack (non-200 response)
- **AC-05**: **Given** a previously processed webhook with the same `providerEventId` (e.g., the same `data.id` in the payload), **When** a second request arrives with a valid signature, **Then** the route returns HTTP 200 without reprocessing the event (idempotent). The existing `billingWebhookEvents` record remains unchanged

**Important note for AC-02/AC-03/AC-04**: The exact rejection status code depends on `@qazuor/qzpay-hono`'s behavior. The test should verify the route returns a non-200 status. If QZPay returns 200 even for invalid signatures (which would be a bug), the test documents this behavior and a follow-up issue should be created.

---

#### US-02: Brute-Force Login Protection

**As a** registered user,
**I want** my account to be temporarily locked after multiple failed login attempts,
**so that** an attacker cannot brute-force my password even if they bypass IP-level rate limiting.

**Background - How login works in this codebase:**

- Better Auth handles signin at `POST /api/auth/sign-in/email` via a catch-all handler in `apps/api/src/routes/auth/handler.ts`
- There is NO custom signin route.. Better Auth owns the entire `/api/auth/*` path via `app.on(['GET', 'POST'], '/*', (c) => { const auth = getAuth(); return auth.handler(c.req.raw); })`
- Better Auth does NOT expose hooks for auth events (no `onSignIn`, `onFailedLogin`, etc.). It only has `databaseHooks` for user CRUD (create.before, create.after, update.after)
- The catch-all handler delegates directly: `auth.handler(c.req.raw)` with no middleware interception
- Existing rate limiting is IP-based only (50 requests/5min for auth endpoints) via `apps/api/src/middlewares/rate-limit.ts`
- **Better Auth has its own built-in rate limiter**: 3 requests per 10 seconds for `/sign-in/email` (per-IP). This runs inside `auth.handler()`, so the lockout handler sees the 429 response from Better Auth. See "Interaction with Better Auth rate limiter" below

**Implementation approach**: Create a Hono route handler that intercepts `POST /sign-in/email` BEFORE the Better Auth catch-all handler. This handler:

1. Clones the request with `c.req.raw.clone()` to read the `email` from body without consuming it
2. Checks if the email is locked out (too many failed attempts)
3. If locked: returns 429 immediately without forwarding to Better Auth
4. If not locked: forwards `c.req.raw` (original, unread) to Better Auth, then inspects the response
5. On Better Auth rate limit (429 from Better Auth): returns the response as-is WITHOUT counting it as a failed login attempt. See "Interaction with Better Auth rate limiter" below
6. On auth failure (401 status from Better Auth.. Better Auth returns HTTP 401 with code `INVALID_EMAIL_OR_PASSWORD` for invalid credentials when used with Hono): increments the failed attempt counter for that email. A defensive body check is also included as a safety net (see note on issue #7035 below)
7. On auth success (200 from Better Auth): resets the counter for that email

**Note on Better Auth issue #7035**: This issue reports HTTP 200 with error in response body instead of proper 4xx status. However, investigation confirms this is **specific to Elysia.js** (where the framework overwrites the Response status to 200). **Hono correctly preserves Response status codes**, so Better Auth returns 401 for invalid credentials in this codebase. The lockout handler includes a defensive body check as a safety net, but the primary detection mechanism is the HTTP status code. T-001 MUST verify this empirically.

**Interaction with IP rate limiter**: The lockout middleware runs AFTER the IP rate limiter. A locked-out user's 429 responses still count toward IP rate limiting. This is by design.. an attacker brute-forcing one email will eventually hit both account lockout AND IP rate limiting.

**Interaction with Better Auth rate limiter**: Better Auth has a built-in rate limiter that limits `/sign-in/email` to 3 requests per 10 seconds (per-IP). This rate limiter runs inside `auth.handler()`, so the lockout handler receives the 429 response. The lockout handler MUST NOT count Better Auth's 429 responses as failed login attempts, because they are not authentication failures.. they are rate limit responses. A 429 from Better Auth would be indistinguishable from a lockout 429 to the user, causing confusion. The handler checks `response.status === 429` BEFORE checking for auth failure, and returns the response as-is without recording a failed attempt.

**Acceptance Criteria:**

- **AC-01**: **Given** 5 consecutive failed login attempts for the same email within 15 minutes, **When** a 6th attempt is made (even with the correct password), **Then** the response is `429 Too Many Requests` with body:

  ```json
  {
    "success": false,
    "error": {
      "code": "ACCOUNT_LOCKED",
      "message": "Too many failed login attempts. Please try again in N minutes or use password reset.",
      "retryAfter": 900
    }
  }
  ```

  And the response includes a `Retry-After` header with the remaining seconds.
  Note: The message is in English because this is an API response. The frontend maps the `ACCOUNT_LOCKED` code to a localized user-facing message.
- **AC-02**: **Given** a locked account, **When** the lockout window (15 minutes) expires, **Then** the next login attempt with valid credentials succeeds normally
- **AC-03**: **Given** a successful login, **When** the user had previous failed attempts below the threshold, **Then** the failed attempt counter is reset to zero
- **AC-04**: **Given** the lockout configuration, **When** environment variables `HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS` and `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS` are set, **Then** those values override the defaults (5 and 900000 respectively)
- **AC-05**: **Given** the lockout tracking store, **When** Redis is available (`HOSPEDA_REDIS_URL` is set), **Then** lockout state is stored in Redis with key pattern `lockout:<email>` and TTL equal to the window. **When** Redis is unavailable, **Then** an in-memory `Map<string, LockoutEntry>` fallback is used with a logged warning (same pattern as `rate-limit.ts`)
- **AC-06**: **Given** the lockout handler, **When** it is registered, **Then** it ONLY intercepts `POST /sign-in/email` requests. All other `/api/auth/*` routes pass through to the catch-all unaffected

---

#### US-03: Security Audit Logging

**As a** platform operator,
**I want** security-sensitive operations to produce structured audit log entries,
**so that** I can investigate incidents and satisfy compliance requirements.

**Background - How logging works in this codebase:**

- `@repo/logger` has a category system via `registerCategory(name, key, options)` .. NOT "channels"
- `registerCategory()` returns an `ILogger` object with `.info()`, `.warn()`, `.error()`, `.debug()` methods
- Available exports from `@repo/logger`: `logger`, `registerCategory`, `createLogger`, `LoggerColors` (enum), `LogLevel` (enum)
- The API uses `apiLogger` (category `'API'`) created in `apps/api/src/utils/logger.ts` via `logger.registerCategory('API', 'API', { color: LoggerColors.BLUE, ... })`
- `apiLogger` already has a custom `.permission()` method registered via `registerLogMethod()`
- Permission denials are currently logged with `apiLogger.warn()` in `authorization.ts` (6 denial points at lines ~89, ~106, ~115, ~132, ~140, ~149) but without structured event schemas
- `@repo/logger` outputs to `console.*` methods. File logging is a TODO. There are no external transports
- `service-core` has `logPermission()`, `logDenied()`, `logGrant()` utilities in `packages/service-core/src/utils/logging.ts` but these are not used for structured audit events
- Better Auth does NOT expose hooks for failed login events, so audit logging for failed logins must be done via the lockout handler from US-02

**Acceptance Criteria:**

- **AC-01**: **Given** a failed authentication attempt intercepted by the lockout handler (US-02), **When** the handler detects a failed login (non-200 response from Better Auth.. expected 401 with Hono, with a defensive body check as safety net), **Then** an audit log entry is written with the following structure:

  ```json
  {
    "auditEvent": "auth.login.failed",
    "email": "<attempted-email>",
    "ip": "<client-ip>",
    "timestamp": "<ISO-8601>",
    "reason": "invalid_credentials",
    "attemptNumber": 3,
    "locked": false
  }
  ```

- **AC-01b**: **Given** a successful authentication attempt intercepted by the lockout handler, **When** the handler detects a successful login (200 response from Better Auth), **Then** an audit log entry is written with:

  ```json
  {
    "auditEvent": "auth.login.success",
    "email": "<email>",
    "ip": "<client-ip>",
    "timestamp": "<ISO-8601>"
  }
  ```

- **AC-02**: **Given** a permission denial (401 or 403) in the authorization middleware, **When** the middleware throws an HTTPException, **Then** an audit log entry is written with:

  ```json
  {
    "auditEvent": "access.denied",
    "actorId": "<user-id-or-anonymous>",
    "actorRole": "<role-or-guest>",
    "resource": "/api/v1/admin/users",
    "method": "GET",
    "statusCode": 403,
    "reason": "insufficient_permissions",
    "requiredPermissions": ["ACCESS_PANEL_ADMIN"],
    "timestamp": "<ISO-8601>"
  }
  ```

- **AC-03**: **Given** an admin billing mutation (create/update/delete on promo codes, billing settings changes, trial extensions) in the billing admin routes, **When** the operation completes successfully, **Then** an audit log entry is written with:

  ```json
  {
    "auditEvent": "billing.mutation",
    "actorId": "<user-id>",
    "action": "create|update|delete",
    "resourceType": "promo_code|billing_settings|trial",
    "resourceId": "<entity-id>",
    "timestamp": "<ISO-8601>"
  }
  ```

- **AC-04**: **Given** a user role or permission change via admin user routes (`PUT/PATCH /api/v1/admin/users/:id`), **When** the update includes changes to role or permission fields, **Then** an audit log entry is written with:

  ```json
  {
    "auditEvent": "permission.change",
    "actorId": "<admin-user-id>",
    "targetUserId": "<affected-user-id>",
    "changeType": "role_assignment|permission_grant|permission_revoke",
    "oldValue": "<previous-role-or-permission>",
    "newValue": "<new-role-or-permission>",
    "timestamp": "<ISO-8601>"
  }
  ```

  Note: `UserUpdateInputSchema` and `UserPatchInputSchema` already include `role` and `permissions` fields (they inherit from `UserSchema` which defines `role: RoleEnumSchema` and `permissions: z.array(PermissionEnumSchema)`). The audit call MUST be implemented, not deferred.
- **AC-04b**: **Given** a user signout via the Hospeda cleanup route (`POST /api/v1/auth/signout`), **When** the cleanup completes, **Then** an audit log entry is written with:

  ```json
  {
    "auditEvent": "session.signout",
    "actorId": "<user-id-or-anonymous>",
    "ip": "<client-ip>",
    "timestamp": "<ISO-8601>"
  }
  ```

- **AC-05**: **Given** the audit logger utility, **When** it writes an entry, **Then** it uses a dedicated `AUDIT` logger category registered with `logger.registerCategory('AUDIT', 'AUDIT', { color: LoggerColors.RED })` and the entry is structured JSON. Sensitive data (passwords, tokens, session IDs, connection strings) MUST never appear in audit entries
- **AC-06**: **Given** the audit log entries, **When** they are produced, **Then** every entry includes at minimum: `auditEvent`, `timestamp` (ISO-8601), and either `actorId` or `email` (for unauthenticated events)

---

#### US-04: Session Invalidation Test Coverage

**As a** platform operator,
**I want** automated tests verifying that signout fully invalidates server-side sessions,
**so that** a regression in Better Auth or Hospeda code cannot silently leave sessions active after signout.

**Background - How signout works in this codebase:**

- Better Auth ALREADY handles server-side session deletion correctly. This is NOT broken.
- Two signout endpoints exist:
  1. `POST /api/auth/sign-out` (Better Auth native): Deletes session from `session` DB table, clears `better-auth.session_token` cookie
  2. `POST /api/v1/auth/signout` (Hospeda custom, in `apps/api/src/routes/auth/signout.ts`): Invalidates user cache via `userCache.invalidate(userId)`, clears rate limit entries for the user's IP via `clearRateLimitForIp({ ip })`. Returns `{ message: string, cacheCleared: boolean }`
- Session storage: PostgreSQL `session` table (defined in `packages/db/src/schemas/user/session.dbschema.ts`, exported as `sessions` variable) with columns:
  - `id` (TEXT PK), `token` (TEXT UNIQUE), `expiresAt` (TIMESTAMP), `createdAt` (TIMESTAMP), `updatedAt` (TIMESTAMP), `ipAddress` (TEXT), `userAgent` (TEXT), `userId` (UUID FK -> users.id, CASCADE), `impersonatedBy` (TEXT), `twoFactorVerified` (BOOLEAN)
- Cookie: `better-auth.session_token` (HttpOnly, set by Better Auth)
- Session resolution: `auth.api.getSession({ headers })` reads cookie, validates against DB
- Hospeda signout extracts IP using Hono context: `c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'`
- No existing tests verify the full signout flow (session deletion + cookie clearing + token rejection)

**This US does NOT modify any code. It only adds tests.**

**Acceptance Criteria:**

- **AC-01**: **Given** a valid authenticated session (user has signed in and received a session cookie), **When** the user calls `POST /api/auth/sign-out` with the session cookie, **Then** the session record is deleted from the `session` database table (verified by querying the table directly)
- **AC-02**: **Given** a session token that was valid before signout, **When** it is used in a subsequent authenticated request (e.g., `GET /api/v1/protected/users/me`), **Then** the request is treated as unauthenticated (returns 401 or the actor is resolved as guest)
- **AC-03**: **Given** the signout response, **When** the response is returned, **Then** the `Set-Cookie` header contains a `better-auth.session_token` with an expiry in the past or `Max-Age=0` (clearing the cookie)
- **AC-04**: **Given** the Hospeda cleanup route `POST /api/v1/auth/signout`, **When** called after Better Auth signout, **Then** the response contains `cacheCleared: true` (or `cacheCleared: false` if the user was already unauthenticated)

---

### 3. UX Considerations

#### User-Facing Impact

- **Brute-force lockout**: Users who genuinely forget their password and try many times will see a lockout message. The API returns `ACCOUNT_LOCKED` error code with `retryAfter` seconds. The frontend MUST map this to a localized message that: (1) shows how many minutes to wait, (2) suggests using the password reset flow (frontend: `/auth/forgot-password`). The lockout only affects `POST /sign-in/email`. Password reset (`POST /api/auth/forget-password`), signup, and other auth flows remain available.
- **Session invalidation**: No visible change for users. Signout works as expected. Tests verify existing behavior.
- **Audit logging**: No user-facing impact. Operator tooling only.
- **Webhook tests**: No user-facing impact. Developer confidence only.

#### Error States

- **Account locked (429 response)**:

  ```json
  {
    "success": false,
    "error": {
      "code": "ACCOUNT_LOCKED",
      "message": "Too many failed login attempts. Please try again in 12 minutes or use password reset.",
      "retryAfter": 720
    }
  }
  ```

  - The `retryAfter` value is in seconds and represents the remaining lockout time (NOT the full window)
  - The `Retry-After` HTTP header contains the same value
  - The message dynamically shows the remaining minutes (rounded up)

---

### 4. Out of Scope

- **Multi-factor authentication (MFA)**: Separate feature
- **CSRF token testing**: Delegated to Better Auth, out of scope per SPEC-019
- **IP allowlisting for admin routes**: Infrastructure-level control
- **Automated penetration testing**: Separate engagement
- **Audit log UI/dashboard**: This spec adds the logging mechanism. A query interface is a future feature
- **Database-backed audit table**: Initial implementation uses structured logging via `@repo/logger` category system. Migration to a database table is deferred
- **Modifying Better Auth's signout behavior**: Better Auth already handles session deletion correctly. This spec only adds test coverage
- **Testing QZPay internals**: We test the route behavior (integration tests), not the library's internal HMAC implementation
- **Audit logging for QZPay-mounted billing routes**: QZPay's pre-built routes (`/api/v1/billing/subscriptions`, `/api/v1/billing/payments`, etc.) are owned by the external library. Audit logging for those is deferred
- **Audit logging for non-admin billing mutations**: User self-service routes (addon purchase, plan change) are lower security risk and deferred

---

### 5. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Brute-force lockout causes legitimate user frustration | Medium | Low | Clear error message with retry timer and password reset link |
| Audit logging increases log volume | Low | Low | Dedicated `AUDIT` category. Only security events, not all requests |
| Redis dependency for lockout state adds failure mode | Low | Medium | In-memory fallback with logged warning (same pattern as `rate-limit.ts`) |
| QZPay changes signature rejection status code | Low | Low | Tests document current behavior. Update tests if QZPay changes |
| Lockout handler interferes with Better Auth catch-all | Medium | High | Handler registered on specific path `POST /sign-in/email` only. All other auth routes unaffected |
| Request body consumed before Better Auth reads it | Medium | High | Clone request before reading body. Use `c.req.raw.clone()` for the clone, forward original `c.req.raw` to Better Auth |
| Better Auth updates change session deletion behavior | Low | Medium | Tests will detect regression. Pin Better Auth version |
| Better Auth returns HTTP 200 with error in body for failed login | Low | Medium | Better Auth issue #7035 is Elysia.js-specific. Hono preserves Response status codes correctly, so Better Auth returns 401 for invalid credentials. Handler includes defensive body check via `response.clone()` as safety net. T-001 must verify empirically |
| Better Auth built-in rate limiter triggers false lockouts | Medium | Medium | Better Auth rate-limits `/sign-in/email` at 3 req/10s. Lockout handler checks `response.status === 429` and returns as-is without counting as failed attempt. Test 6 in T-008 verifies this |

---

### 6. Known Limitations (Accepted Risk)

- **Lockout is per-email, not per-IP+email**: A distributed attacker using many IPs against one email will still trigger lockout. This is by design (protects the account). An attacker targeting many emails from one IP is handled by existing IP rate limiting (50 req/5min).
- **Audit logs are append-only structured console logs**: No database table or query API in v1. Operators use log aggregation tools (Vercel Logs, Datadog, etc.) to search audit entries.
- **Webhook signature tests depend on QZPay behavior**: We cannot unit-test the HMAC verification itself (it's in an external library). Integration tests verify the route's end-to-end behavior.
- **Lockout handler reads request body**: The handler must clone `c.req.raw` before reading the body to extract the email, because Hono's request body can only be read once. If the clone fails, the handler falls through (no lockout check) and logs a warning.
- **Better Auth session deletion is not directly observable from HTTP**: Tests must query the `session` DB table directly to verify deletion. This requires the E2E test setup with `TestDatabaseManager`.
- **`scrubSensitiveData()` only checks top-level field names**: Nested fields matching sensitive patterns (e.g., `metadata.token`) will NOT be redacted. This is acceptable for v1 since audit entries have flat schemas. Document as a TODO for future improvement.
- **Better Auth built-in rate limiter interaction**: Better Auth has its own rate limiter (3 requests per 10 seconds for `/sign-in/email`, per-IP). When triggered, Better Auth returns 429 from inside `auth.handler()`. The lockout handler receives this 429 and returns it as-is WITHOUT counting it as a failed login attempt. This prevents false lockouts caused by rate limiting. However, the user sees a generic "Too many requests" message from Better Auth (not the lockout-specific `ACCOUNT_LOCKED` message). This is acceptable because the user is genuinely sending too many requests.
- **`getClientIp()` respects `trustProxy` config**: The shared `getClientIp()` from `rate-limit.ts` respects `API_RATE_LIMIT_TRUST_PROXY`. When `trustProxy` is false (default), it returns the socket remote address, not proxy headers. This means lockout audit logs may show `'unknown'` (in serverless environments where socket address is unavailable) instead of the end-user IP. This is acceptable because: (1) the lockout is per-email not per-IP, so the IP is informational only for audit logs, and (2) an attacker cannot exploit this to bypass lockout (they'd need to spoof the email, not the IP). When `trustProxy` is true (recommended behind Vercel/Cloudflare), `cf-connecting-ip`, `x-forwarded-for`, and `x-real-ip` headers are used.

---

## Part 2 - Technical Analysis

### 1. Architecture Overview

Changes are primarily additive (new tests, new handler, new utility). No new utility files for client IP extraction are needed (the existing `getClientIp` from `rate-limit.ts` is reused). No existing behavior is modified except:

- `apps/api/src/routes/auth/handler.ts`: A specific route handler is added BEFORE the catch-all to intercept signin attempts
- `apps/api/src/routes/auth/signout.ts`: Audit log call added for session signout events
- `apps/api/src/middlewares/authorization.ts`: Audit log calls added alongside existing `apiLogger.warn()` calls
- `apps/api/src/utils/env.ts`: New env vars added to `ApiEnvSchema`
- `apps/api/.env.example`: New env vars documented
- `apps/api/src/routes/billing/promo-codes.ts`: Audit log calls after admin mutations
- `apps/api/src/routes/billing/settings.ts`: Audit log calls after admin mutations
- `apps/api/src/routes/billing/trial.ts`: Audit log calls after admin mutations (extend, check-expiry)
- `apps/api/src/routes/user/admin/update.ts`: Audit log call for role/permission changes (schemas already include these fields)
- `apps/api/src/routes/user/admin/patch.ts`: Audit log call for role/permission changes (schemas already include these fields)

| Layer | Artifact | Change Type | Description |
|-------|----------|-------------|-------------|
| `apps/api` | `test/integration/webhooks/webhook-signature.test.ts` | **New** | Integration tests for webhook route signature handling |
| `apps/api` | `test/integration/webhooks/webhook-idempotency-full.test.ts` | **New** | Full idempotency integration test with DB verification |
| `apps/api` | `src/middlewares/auth-lockout.ts` | **New** | Account lockout store and functions |
| `apps/api` | `test/middlewares/auth-lockout.test.ts` | **New** | Unit tests for lockout functions |
| `apps/api` | `test/integration/auth/auth-lockout.test.ts` | **New** | Integration test for full lockout flow |
| `apps/api` | `src/utils/audit-logger.ts` | **New** | Structured audit logging utility |
| `apps/api` | `test/utils/audit-logger.test.ts` | **New** | Unit tests for audit logger |
| `apps/api` | `test/integration/audit/audit-logging.test.ts` | **New** | Integration tests for audit log production |
| `apps/api` | `test/integration/auth/signout-session.test.ts` | **New** | Integration tests for session invalidation |
| `apps/api` | `src/routes/auth/handler.ts` | **Modified** | Add lockout handler before catch-all |
| `apps/api` | `src/routes/auth/signout.ts` | **Modified** | Add session.signout audit log call |
| `apps/api` | `src/middlewares/authorization.ts` | **Modified** | Add audit log calls on denial |
| `apps/api` | `src/utils/env.ts` | **Modified** | Add lockout env vars |
| `apps/api` | `.env.example` | **Modified** | Document new env vars |
| `apps/api` | `src/routes/billing/promo-codes.ts` | **Modified** | Add audit log calls on admin mutations |
| `apps/api` | `src/routes/billing/settings.ts` | **Modified** | Add audit log calls on settings changes |
| `apps/api` | `src/routes/billing/trial.ts` | **Modified** | Add audit log calls on admin trial mutations |
| `apps/api` | `src/routes/user/admin/update.ts` | **Modified** | Add audit log for role/permission changes |
| `apps/api` | `src/routes/user/admin/patch.ts` | **Modified** | Add audit log for role/permission changes |

---

### 2. Detailed Implementation Reference

This section provides the exact code patterns, file paths, imports, and conventions that the implementor MUST follow. All paths are relative to the monorepo root.

#### 2.1 Existing Patterns to Follow

**Test framework**: Vitest with `globals: true` (no need to import `describe`, `it`, `expect`).

**HTTP testing**: Hono's built-in `app.request()` method. NOT supertest (supertest is not used anywhere in this project).

**App initialization for integration tests**: All integration tests use `initApp()` from `apps/api/src/app.ts`:

```typescript
import { initApp } from '../../../src/app'; // adjust relative path based on test location
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';

let app: AppOpenAPI;

beforeAll(() => {
    validateApiEnv();
    app = initApp();
});
```

Reference: `apps/api/test/integration/auth/auth.test.ts` lines 6-17.

**HTTP request pattern** (from existing integration tests):

```typescript
const response = await app.request('/api/v1/endpoint', {
    method: 'POST',
    headers: {
        'user-agent': 'vitest',
        'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
});
expect(response.status).toBe(200);
const body = await response.json();
```

**Mocking**: `vi.mock()` at top-level with factory functions.

**Logger mock** (from `apps/api/test/setup.ts` lines 62-119):

```typescript
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn(),
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis(),
    };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors: { RED: 'RED', BLUE: 'BLUE', GREEN: 'GREEN', YELLOW: 'YELLOW' },
        LogLevel: { LOG: 'LOG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' },
    };
});
```

**IMPORTANT - Setup file difference between unit and integration tests**:

- **Unit tests** (`vitest.config.ts`): Uses `setupFiles: ['./test/setup.ts']` which globally mocks `@repo/logger`, `@repo/db`, and `@repo/service-core`. All unit tests automatically have these mocks available.
- **Integration/E2E tests** (`vitest.config.e2e.ts`): Uses `setupFiles: ['./test/e2e/setup/env-setup.ts', './test/e2e/setup/test-database.ts']`. This does NOT include `test/setup.ts`, so `@repo/logger` is NOT automatically mocked. Integration tests that need to spy on logger calls must set up their own mocks or use `vi.spyOn()`.

**Redis pattern** (from `apps/api/src/middlewares/rate-limit.ts`):

- Store interface: `get(key)`, `set(key, entry, windowMs)`, `has(key)`, `clear()`, `deleteByIp(ip)`
- Redis keys: `<prefix>:<identifier>` with TTL via `redis.set(key, JSON.stringify(entry), 'EX', ttlSeconds)`
- In-memory: `Map<string, Entry>` with cleanup interval (5 min, `CLEANUP_INTERVAL_MS`) and max lifetime (1 hour, `MAX_ENTRY_LIFETIME_MS`)
- Store selection: lazy, singleton, based on `HOSPEDA_REDIS_URL` presence via `getStore()` function
- Redis client: `getRedisClient()` from `apps/api/src/utils/redis.ts` returns `Promise<Redis | undefined>` (ASYNC.. must be awaited)
- In-memory cleanup interval: `.unref()` on the interval, disabled when `NODE_ENV === 'test'`
- On Redis error: fall back to in-memory + `apiLogger.warn()`

**Env schema pattern** (from `apps/api/src/utils/env.ts`):

```typescript
// The project uses z.coerce for string-to-type conversion, NOT z.preprocess
HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
HOSPEDA_AUTH_LOCKOUT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
```

**Env vars in integration tests**: Set via `process.env` at the top of the test file, BEFORE any app imports:

```typescript
// Pattern from existing integration tests (e.g., qzpay-ownership-integration.test.ts)
process.env.NODE_ENV = 'test';
process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS = '5';
process.env.HOSPEDA_AUTH_LOCKOUT_WINDOW_MS = '500';
```

**Vitest configs**:

- Unit tests: `apps/api/vitest.config.ts` (parallel, 3 forks, setup: `test/setup.ts`, excludes `test/e2e/**` and `test/integration/**`)
- Integration tests: `apps/api/vitest.config.e2e.ts` (sequential, `singleFork: true`, 30s timeout, includes `test/e2e/**` and `test/integration/**`, setup: `test/e2e/setup/env-setup.ts` + `test/e2e/setup/test-database.ts`)
- Run integration tests: `pnpm test:e2e` (builds deps first, then runs with e2e config)

**Test database manager** (for integration tests that need DB access):

```typescript
// Import from E2E setup
import { testDb } from '../../e2e/setup/test-database';

// In beforeAll:
await testDb.setup();

// Get Drizzle instance:
const db = testDb.getDb();

// In afterAll:
await testDb.teardown();

// Clean all tables (use sparingly):
await testDb.clean();
```

Requires `TEST_DB_URL` env var (or `TEST_DB_USER`/`TEST_DB_PASSWORD`/`TEST_DB_HOST`/`TEST_DB_PORT`/`TEST_DB_NAME`).

**Creating a test user** (for integration tests that need authentication):

```typescript
// Sign up a test user via Better Auth API
const signupRes = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
    body: JSON.stringify({
        email: 'test-lockout@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
    }),
});
// Extract session cookie for authenticated requests
const setCookie = signupRes.headers.get('set-cookie');
const sessionCookie = setCookie?.split(';')[0]; // "better-auth.session_token=..."
```

**Client IP extraction** (shared utility already exists):

`getClientIp({ c })` is already exported from `apps/api/src/middlewares/rate-limit.ts` (line 244). It is already imported and used by `signout.ts` (line 2: `import { clearRateLimitForIp, getClientIp } from '../../middlewares/rate-limit'`). The function respects the `API_RATE_LIMIT_TRUST_PROXY` config and handles `cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`, and socket remoteAddress.

**Do NOT create a separate `client-ip.ts` utility.** Import `getClientIp` from `../../middlewares/rate-limit` in all new code that needs client IP (lockout handler, audit logger calls, etc.), following the same pattern as `signout.ts`.

**Note on trustProxy**: The existing `getClientIp()` respects `API_RATE_LIMIT_TRUST_PROXY` (default `false`). When `trustProxy` is false, it returns the socket remote address instead of proxy headers. This means lockout audit logs will show the socket IP (or `'unknown'` in serverless), not the end-user IP, unless `trustProxy` is enabled. This is acceptable because lockout is per-email, not per-IP.. the IP is informational for audit logs only.

#### 2.2 Key File Locations

| What | Path |
|------|------|
| Webhook router factory | `apps/api/src/routes/webhooks/mercadopago/router.ts` |
| Webhook event handler (idempotency) | `apps/api/src/routes/webhooks/mercadopago/event-handler.ts` |
| Webhook utilities | `apps/api/src/routes/webhooks/mercadopago/utils.ts` |
| Webhook types | `apps/api/src/routes/webhooks/mercadopago/types.ts` |
| MercadoPago adapter config | `packages/billing/src/adapters/mercadopago.ts` |
| Better Auth config + databaseHooks | `apps/api/src/lib/auth.ts` |
| Auth catch-all handler | `apps/api/src/routes/auth/handler.ts` |
| Signout cleanup route | `apps/api/src/routes/auth/signout.ts` |
| Rate limit middleware + `getClientIp` | `apps/api/src/middlewares/rate-limit.ts` (exports `getClientIp`, `clearRateLimitForIp`) |
| Authorization middleware | `apps/api/src/middlewares/authorization.ts` |
| Actor middleware | `apps/api/src/middlewares/actor.ts` |
| Auth middleware | `apps/api/src/middlewares/auth.ts` |
| App factory + middleware stack | `apps/api/src/utils/create-app.ts` |
| App initialization | `apps/api/src/app.ts` (exports `initApp()`) |
| App types | `apps/api/src/types.ts` (exports `AppOpenAPI`) |
| API logger setup | `apps/api/src/utils/logger.ts` |
| Redis client | `apps/api/src/utils/redis.ts` |
| Env schema | `apps/api/src/utils/env.ts` |
| Logger package | `packages/logger/src/logger.ts` |
| Logger types + enums | `packages/logger/src/types.ts` |
| Session DB schema | `packages/db/src/schemas/user/session.dbschema.ts` (exports `sessions`) |
| Webhook events DB table | `packages/db/src/billing/index.ts` (exports `billingWebhookEvents`) |
| Service-core logging utils | `packages/service-core/src/utils/logging.ts` |
| User schemas | `packages/schemas/src/entities/user/user.crud.schema.ts` (exports `UserUpdateInputSchema`, `UserPatchInputSchema`) |
| User base schema | `packages/schemas/src/entities/user/user.schema.ts` (includes `role` and `permissions` fields) |
| Existing webhook unit tests | `apps/api/test/routes/webhooks/webhook-idempotency-db.test.ts` |
| Existing webhook integration tests | `apps/api/test/integration/webhook-retry-flow.test.ts` |
| Existing auth integration tests | `apps/api/test/integration/auth/auth.test.ts` |
| Test setup (unit) | `apps/api/test/setup.ts` |
| Test env setup (E2E) | `apps/api/test/e2e/setup/env-setup.ts` |
| Test DB manager | `apps/api/test/e2e/setup/test-database.ts` |
| E2E setup verification | `apps/api/test/e2e/setup.test.ts` |
| Promo codes route (billing admin mutations) | `apps/api/src/routes/billing/promo-codes.ts` |
| Billing settings route (admin mutations) | `apps/api/src/routes/billing/settings.ts` |
| Trial route (admin mutations) | `apps/api/src/routes/billing/trial.ts` |
| User admin update route | `apps/api/src/routes/user/admin/update.ts` |
| User admin patch route | `apps/api/src/routes/user/admin/patch.ts` |
| OpenAPI transform utils | `apps/api/src/utils/openapi-schema.ts` (exports `transformApiInputToDomain`) |

#### 2.3 Important Codebase Conventions for Implementors

**Two `getActorFromContext` implementations**: There are two separate implementations of `getActorFromContext` in the codebase with **different behavior**:

- `apps/api/src/middlewares/actor.ts` - **Throws HTTPException(500)** if actor missing. Used by billing routes (`promo-codes.ts`, `settings.ts`, `trial.ts`)
- `apps/api/src/utils/actor.ts` - **Returns guest actor as fallback** (logs warn). Used by user admin routes (`update.ts`, `patch.ts`, `delete.ts`, etc.) and authorization middleware

**Rule**: When adding a new `getActorFromContext` import, use the SAME import path as the existing imports in that file or in sibling files within the same directory. Specifically:

- Files in `routes/billing/` import from `../../middlewares/actor`
- Files in `routes/user/admin/` import from `../../../utils/actor`
- Files in `middlewares/` import from `../utils/actor`

**`ServiceOutput<T>` type** (from `packages/service-core/src/types/index.ts`):

```typescript
type ServiceOutput<T> =
    | { data: T; error?: never }          // Success case
    | { data?: never; error: { code: ServiceErrorCode; message: string } }  // Error case
```

Use `result.data` for the success value, `result.error` for the error. Check `result.error` first (or `result.data` nullability) before accessing data.

**`transformApiInputToDomain()`** (from `apps/api/src/utils/openapi-schema.ts`): Recursively processes input objects and arrays, converting ISO date strings to `Date` objects. Non-date fields (including `role`, `permissions`, strings, numbers, booleans) pass through unchanged. In `patch.ts`, use `domainInput.role` and `domainInput.permissions` (not `body.role`/`body.permissions`) for the permission change audit comparison, since `transformApiInputToDomain` is applied before the service call.

**`eq` from `@repo/db`**: The `eq` function (from Drizzle ORM) is re-exported by `packages/db/src/index.ts` (line 4). The import `import { sessions, eq } from '@repo/db'` is correct and verified.

**`forget-password` vs `forgot-password`**: Better Auth uses `forget-password` as its API endpoint path (`POST /api/auth/forget-password`). The frontend page files are named `forgot-password.astro` (the URL path visible to users), but the actual Better Auth API endpoint is `forget-password`. Do NOT confuse these.

---

### 3. Implementation Phases

#### Phase 1: Webhook Route Security Tests (3 tasks)

**T-001: Analyze webhook route and QZPay integration** (complexity: 2)

Read and understand the following files to document:

- `apps/api/src/routes/webhooks/mercadopago/router.ts`: How `createWebhookRouter()` is called. Confirmed config: `signatureHeader: 'x-signature'`, handlers map (`payment.created`, `payment.updated`, `subscription_preapproval.updated`, `chargebacks`, `payment.dispute`), `onEvent: handleWebhookEvent`, `onError: handleWebhookError`
- `apps/api/src/routes/webhooks/mercadopago/event-handler.ts`: How `handleWebhookEvent()` handles idempotency. Uses `providerEventId = String(event.id)`. Optimistic INSERT first, then handles duplicate detection via DB unique constraint. On duplicate, retries status check up to 3 times with 50ms delays
- `packages/billing/src/adapters/mercadopago.ts`: How the adapter is created. Production REQUIRES `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` (throws error if missing). Sandbox warns but continues without it (signature verification skipped). Search for `webhookSecret` to find these checks
- `apps/api/test/routes/webhooks/webhook-idempotency-db.test.ts`: Existing test patterns for webhook utilities

**Critical output of T-001**: Document and verify the following (pre-researched values provided below, but MUST be confirmed against the installed QZPay version):

1. What status code QZPay returns for invalid signatures
2. What data is included in the HMAC-SHA256 computation
3. The replay window duration
4. How to construct a valid test signature
5. What status code Better Auth returns for invalid login credentials (test empirically with a wrong password). **EXPECTED**: Better Auth returns HTTP 401 with code `INVALID_EMAIL_OR_PASSWORD` when used with Hono (issue #7035 is Elysia.js-specific, not applicable to Hono which preserves Response status codes). T-001 MUST confirm this empirically and document the exact status code and response body. The T-006 lockout handler includes a defensive body check as safety net, but the primary detection mechanism is `response.status !== 200`
6. What env vars are needed for `getQZPayBilling()` to return a non-null billing instance (beyond the 3 MercadoPago vars). If `getQZPayBilling()` returns `null`, the webhook router is never created and all webhook tests will get 404

**Pre-researched HMAC algorithm** (from `@qazuor/qzpay-mercadopago@1.1.0` source, verified against installed version):

**IMPORTANT - QZPay diverges from official MercadoPago documentation**: The official MercadoPago docs specify that the signed payload uses the `x-request-id` header (a UUID) for the `request-id` field, and that `id` comes from the URL query parameter `data.id`. However, `@qazuor/qzpay-mercadopago@1.1.0` constructs the payload differently:

- Uses the **timestamp** for `request-id` instead of the `x-request-id` header
- Extracts `id` from the **parsed JSON body** instead of from URL query parameters

The tests in this spec MUST match QZPay's actual behavior (not the official MP docs), because we are testing the route's end-to-end behavior through QZPay. If QZPay is updated to match MP's official algorithm, the tests will need to be updated accordingly.

The MercadoPago webhook signature verification **as implemented by QZPay** works as follows:

1. **Header format**: `x-signature: ts=<unix_timestamp_seconds>,v1=<hex_hmac_signature>`

2. **Signed payload construction**: QZPay constructs a string from the parsed JSON body:

   ```
   id:<payment_id>;request-id:<timestamp>;ts:<timestamp>;
   ```

   Where:
   - `<payment_id>` = `parsed.data?.id ?? String(parsed.id)` (data.id takes precedence, extracted from body JSON)
   - `<timestamp>` = the Unix timestamp in seconds from the `ts=` parameter
   - Note the **trailing semicolon** at the end
   - Note that `request-id` uses the **same timestamp value** as `ts` (diverges from official MP docs which expect the `x-request-id` header UUID)

3. **HMAC computation**:

   ```typescript
   const signedPayload = `id:${extractedId};request-id:${timestamp};ts:${timestamp};`;
   const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
   // Compared using crypto.timingSafeEqual (timing-safe)
   ```

4. **Replay window**: **300 seconds (5 minutes)** default. Configurable via `timestampToleranceSeconds` in adapter constructor. Validation: `Math.abs(currentTimeSeconds - timestampSeconds) > toleranceSeconds`

5. **Rejection status code**: **HTTP 401** with body `{ "error": "Invalid webhook signature" }` for all signature failures (missing header, malformed header, wrong HMAC, stale timestamp). Invalid JSON returns HTTP 400.

6. **How to construct a valid test signature in TypeScript**:

   ```typescript
   import { createHmac } from 'node:crypto';

   function createWebhookSignature({
       secret,
       dataId,
       timestamp,
   }: {
       secret: string;
       dataId: string;
       timestamp: number; // Unix seconds
   }): string {
       const signedPayload = `id:${dataId};request-id:${timestamp};ts:${timestamp};`;
       const hmac = createHmac('sha256', secret).update(signedPayload).digest('hex');
       return `ts=${timestamp},v1=${hmac}`;
   }

   // Usage:
   const ts = Math.floor(Date.now() / 1000);
   const signature = createWebhookSignature({
       secret: 'test-webhook-secret-for-sig-verification',
       dataId: 'test-payment-123', // Must match payload.data.id
       timestamp: ts,
   });
   // Set header: { 'x-signature': signature }
   ```

**Source files to verify** (in `node_modules/`):

- Core verification logic: `@qazuor/qzpay-mercadopago/dist/index.js` (search for `createHmac`)
- Hono webhook middleware: `@qazuor/qzpay-hono/dist/index.js` (search for `webhookMiddleware`)

**T-002: Write integration tests for webhook signature handling** (complexity: 4)

Create `apps/api/test/integration/webhooks/webhook-signature.test.ts`.

**Webhook route path**: The MercadoPago webhook router is mounted at `/api/v1/webhooks/mercadopago` in `apps/api/src/routes/index.ts` (line 245). The router created by `createWebhookRouter()` from `@qazuor/qzpay-hono` handles POST requests at the root path. Therefore, the full test request URL is:

```
POST /api/v1/webhooks/mercadopago
```

**Billing env vars required**: The webhook router is only created when billing is configured. The following env vars MUST be set (at the top of the test file, BEFORE imports) for the webhook router to initialize:

```typescript
process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = 'test-webhook-secret-for-sig-verification';
process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = 'TEST-fake-access-token-for-tests';
process.env.HOSPEDA_MERCADO_PAGO_SANDBOX = 'true';
```

**IMPORTANT**: All MercadoPago env vars require the `HOSPEDA_` prefix. The billing adapter (`packages/billing/src/adapters/mercadopago.ts`) reads them via `getEnv('HOSPEDA_MERCADO_PAGO_*')` from `@repo/config`. Using unprefixed names (e.g., `MERCADO_PAGO_WEBHOOK_SECRET`) will cause `getQZPayBilling()` to return `null`, the webhook router won't be created, and all tests will get 404.

If `createMercadoPagoWebhookRoutes()` returns `null` (billing not configured), the route will not exist and all tests will get 404. T-001 MUST verify which env vars are needed by reading `getWebhookDependencies()` in `apps/api/src/routes/webhooks/mercadopago/utils.ts`.

**Example webhook payload** (MercadoPago IPN format):

```json
{
    "id": 12345,
    "type": "payment",
    "action": "payment.updated",
    "data": { "id": "test-payment-123" },
    "date_created": "2026-03-06T12:00:00.000-03:00",
    "live_mode": false
}
```

The `id` field is the numeric event ID that becomes `providerEventId = String(event.id)` (i.e., `"12345"`). The `data.id` is the payment ID. Use unique `id` values per test to avoid idempotency conflicts.

**App initialization**:

```typescript
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

let app: AppOpenAPI;

beforeAll(async () => {
    validateApiEnv();
    app = initApp();
    await testDb.setup();
});

afterAll(async () => {
    await testDb.teardown();
});
```

**Signature helper** (add at top of test file, reuse across tests):

```typescript
import { createHmac } from 'node:crypto';

const WEBHOOK_SECRET = 'test-webhook-secret-for-sig-verification';

function createWebhookSignature({
    dataId,
    timestamp,
}: {
    dataId: string;
    timestamp?: number;
}): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const signedPayload = `id:${dataId};request-id:${ts};ts:${ts};`;
    const hmac = createHmac('sha256', WEBHOOK_SECRET).update(signedPayload).digest('hex');
    return `ts=${ts},v1=${hmac}`;
}
```

Tests to implement (all use `app.request()` from Hono, run with `vitest.config.e2e.ts` via `pnpm test:e2e`):

1. `it('should return 200 for a valid webhook request with correct signature')` - Construct a valid payload with `data.id: 'test-payment-sig-1'`, compute the HMAC-SHA256 signature using `createWebhookSignature({ dataId: 'test-payment-sig-1' })`, set the `x-signature` header, POST to `/api/v1/webhooks/mercadopago`, assert 200
2. `it('should reject a request with invalid signature')` - Same payload but wrong HMAC value (e.g., `'ts=123,v1=invalid-hex-value'`), assert status 401 (QZPay returns 401 for all signature failures)
3. `it('should reject a request with missing x-signature header')` - No `x-signature` header, assert status 401
4. `it('should reject a request with stale timestamp')` - Compute valid HMAC but with `ts` value from 10 minutes ago (`Math.floor(Date.now() / 1000) - 600`), assert status 401. QZPay's default replay window is 300 seconds (5 minutes)
5. `it('should document QZPay rejection behavior')` - If QZPay returns 200 for invalid signatures in sandbox mode (which may happen if `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` is empty in test env), document this behavior with a descriptive test name and add a TODO comment

**Note on `billingWebhookEvents`**: This table is defined in the external `@qazuor/qzpay-drizzle` library, re-exported via `packages/db/src/billing/schemas.ts`. Column names and types are defined in the external library. The import `import { billingWebhookEvents } from '@repo/db'` works correctly. Key columns: `providerEventId` (string, unique), `status` (enum: `'pending'` | `'processed'` | `'failed'`), `payload` (JSON), `processedAt` (nullable timestamp).

**Important**: The tests MUST set `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` in the test environment to force signature verification. Without it, QZPay skips verification in sandbox mode. Set this via `process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = 'test-webhook-secret-for-sig-verification'` at the top of the test file, BEFORE any app imports.

**Test cleanup**: Use `afterEach` to clean `billingWebhookEvents` entries created during tests:

```typescript
import { billingWebhookEvents } from '@repo/db';

afterEach(async () => {
    const db = testDb.getDb();
    await db.delete(billingWebhookEvents); // Deletes all rows
});
```

**T-003: Write integration tests for webhook idempotency with DB verification** (complexity: 3)

Create `apps/api/test/integration/webhooks/webhook-idempotency-full.test.ts`.

Tests to implement:

1. `it('should persist webhook event in billingWebhookEvents table')` - Send valid webhook, query DB directly for the `billingWebhookEvents` record matching the `providerEventId`, verify status is `processed`
2. `it('should handle duplicate providerEventId idempotently')` - Send same webhook twice with same `data.id`, verify second returns 200 without creating a new DB record
3. `it('should reprocess a previously failed event')` - Insert a `billingWebhookEvents` record with status `failed` directly into the DB, send webhook with same `providerEventId`, verify it gets reprocessed and status changes to `processed`. Direct INSERT example:

   ```typescript
   const failedEventId = `${Date.now()}-failed`;
   await db.insert(billingWebhookEvents).values({
       provider: 'mercadopago',
       type: 'payment',
       providerEventId: failedEventId,
       status: 'failed',
       payload: { id: Number(failedEventId), type: 'payment', action: 'payment.updated', data: { id: `pay-${failedEventId}` } },
       error: 'Previous processing failed',
   });
   // Then send webhook with same event id and valid signature
   ```

   Note: `billingWebhookEvents` is from external `@qazuor/qzpay-drizzle`. If the INSERT fails due to missing required columns, check the table schema with `T-001` research output

These tests require `TestDatabaseManager` and the same billing env vars as T-002 (set at top of file BEFORE imports):

```typescript
process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = 'test-webhook-secret-for-sig-verification';
process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = 'TEST-fake-access-token-for-tests';
process.env.HOSPEDA_MERCADO_PAGO_SANDBOX = 'true';
```

```typescript
import { testDb } from '../../e2e/setup/test-database';
import { billingWebhookEvents, eq } from '@repo/db';

// Query pattern:
const db = testDb.getDb();
const events = await db.select()
    .from(billingWebhookEvents)
    .where(eq(billingWebhookEvents.providerEventId, testEventId));
```

Use unique `id` values per test (e.g., `Date.now()` or incrementing counter) to avoid idempotency conflicts between tests.

---

#### Phase 2: Brute-Force / Account Lockout (5 tasks)

**T-004: Add lockout env vars to ApiEnvSchema** (complexity: 1)

Modify `apps/api/src/utils/env.ts`:

Add to `ApiEnvSchema` (follow existing `z.coerce` pattern, NOT `z.preprocess`):

```typescript
// Account lockout configuration
HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
HOSPEDA_AUTH_LOCKOUT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 minutes
```

Add to `apps/api/.env.example` in the "Authentication" section:

```env
# Account lockout (brute-force protection)
# HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS=5        # Failed attempts before lockout (default: 5)
# HOSPEDA_AUTH_LOCKOUT_WINDOW_MS=900000      # Lockout window in ms (default: 900000 = 15 min)
```

Verify: `pnpm typecheck` passes in `apps/api`.

**T-005: Create auth-lockout store** (complexity: 4)

Create one file:

**`getClientIp` already exists**: Do NOT create a `client-ip.ts` utility. The `getClientIp({ c })` function is already exported from `apps/api/src/middlewares/rate-limit.ts` (line 244) and is used by `signout.ts`. Import it from there in all new code.

**File: `apps/api/src/middlewares/auth-lockout.ts`**

This follows the same store pattern as `apps/api/src/middlewares/rate-limit.ts`:

**Store interface**:

```typescript
interface LockoutEntry {
    readonly count: number;
    readonly firstAttempt: number; // Unix timestamp ms
}

interface LockoutStore {
    get(email: string): Promise<LockoutEntry | undefined>;
    set(email: string, entry: LockoutEntry, windowMs: number): Promise<void>;
    delete(email: string): Promise<void>;
    clear(): Promise<void>;
}
```

**Redis store**:

- Key pattern: `lockout:<email-lowercase>` (e.g., `lockout:user@example.com`)
- Value: `JSON.stringify({ count, firstAttempt })`
- TTL: `Math.ceil(windowMs / 1000)` seconds (same as rate-limit.ts)
- Use `getRedisClient()` from `apps/api/src/utils/redis.ts`. **IMPORTANT**: This returns `Promise<Redis | undefined>` (async). Must be awaited.
- On Redis error: fall back to in-memory store, log warning via `apiLogger.warn()`

**In-memory store**:

- `Map<string, LockoutEntry>`
- Cleanup interval: 5 minutes (same as rate-limit.ts)
- Max entry lifetime: equal to `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS`
- Disable cleanup interval in test env (`NODE_ENV === 'test'`)
- Use `.unref()` on the interval to not block process exit

**Store selection**: Lazy singleton, based on `HOSPEDA_REDIS_URL` presence (same pattern as rate-limit.ts `getStore()`).

**Exported functions** (NOT a Hono middleware factory.. export individual functions for testability):

```typescript
/** Check if an email is currently locked out. Returns remaining seconds if locked, 0 if not. */
export async function checkLockout({ email }: { email: string }): Promise<{ locked: boolean; retryAfter: number }>

/** Record a failed login attempt. Returns whether the account is now locked. */
export async function recordFailedAttempt({ email }: { email: string }): Promise<{ locked: boolean; attemptNumber: number; retryAfter: number }>

/** Reset the lockout counter (call on successful login). */
export async function resetLockout({ email }: { email: string }): Promise<void>

/** Clear all lockout state (for testing). */
export async function clearLockoutStore(): Promise<void>

/** Reset store selection (for testing). */
export function resetLockoutStore(): void
```

**Configuration reading**: Env vars (`HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS`, `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS`) are read lazily at function call time (NOT at module import time). This allows tests to set `process.env` values before the first lockout call:

```typescript
function getConfig() {
    return {
        maxAttempts: Number(process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS) || 5,
        windowMs: Number(process.env.HOSPEDA_AUTH_LOCKOUT_WINDOW_MS) || 900000,
    };
}
```

**Window calculation**:

```typescript
const { maxAttempts, windowMs } = getConfig();
const now = Date.now();
const entry = await store.get(email.toLowerCase());
if (entry && (now - entry.firstAttempt) < windowMs) {
    // Within window, check count against maxAttempts
} else {
    // Window expired or no entry, start fresh
}
```

**T-006: Integrate lockout handler into auth handler** (complexity: 4)

Modify `apps/api/src/routes/auth/handler.ts`.

The current handler (line 27-30) is a simple catch-all:

```typescript
app.on(['GET', 'POST'], '/*', (c) => {
    const auth = getAuth();
    return auth.handler(c.req.raw);
});
```

Add a specific route BEFORE the catch-all that intercepts only `POST /sign-in/email`:

```typescript
// ALL of these are NEW imports (handler.ts currently only imports getAuth and createRouter)
import { checkLockout, recordFailedAttempt, resetLockout } from '../../middlewares/auth-lockout';
import { getClientIp } from '../../middlewares/rate-limit';
import { auditLog, AuditEventType } from '../../utils/audit-logger';
import { apiLogger } from '../../utils/logger'; // Needed for lockout error fallback logging

// Lockout-protected signin (MUST be registered BEFORE the catch-all)
// IMPORTANT: In Hono, routes are matched in order of registration.
// This specific route MUST come before the catch-all `/*` because
// the catch-all matches ALL paths. If registered after, this handler
// would never execute.
app.post('/sign-in/email', async (c) => {
    // 1. Clone the request to read body without consuming it
    const clonedRequest = c.req.raw.clone();
    let email: string | undefined;

    try {
        const body = await clonedRequest.json();
        email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : undefined;
    } catch {
        // Body parse failed, let Better Auth handle the error
    }

    // 2. Check lockout (if email was extracted)
    // Wrapped in try/catch: lockout failure must NEVER break the login flow.
    // If lockout check fails (Redis error, unexpected state), proceed without lockout protection.
    if (email) {
        try {
            const { locked, retryAfter } = await checkLockout({ email });
            if (locked) {
                const minutes = Math.ceil(retryAfter / 60);
                auditLog({
                    auditEvent: AuditEventType.AUTH_LOCKOUT,
                    email,
                    ip: getClientIp({ c }),
                    attemptNumber: 0, // Already locked, no new attempt
                    retryAfter,
                });
                return c.json({
                    success: false,
                    error: {
                        code: 'ACCOUNT_LOCKED',
                        message: `Too many failed login attempts. Please try again in ${minutes} minutes or use password reset.`,
                        retryAfter,
                    },
                }, 429, {
                    'Retry-After': String(retryAfter),
                });
            }
        } catch (lockoutError) {
            apiLogger.warn({ email, error: lockoutError }, 'Lockout check failed, proceeding without lockout protection');
        }
    }

    // 3. Forward ORIGINAL request to Better Auth (not the clone)
    const auth = getAuth();
    const response = await auth.handler(c.req.raw);

    // 4. Check for Better Auth's own rate limit (429)
    // Better Auth has a built-in rate limiter (3 req/10s for sign-in).
    // If triggered, return the 429 as-is WITHOUT counting as a failed login.
    // This prevents false lockouts from rate limiting.
    if (response.status === 429) {
        return response;
    }

    // 5. Record result (if email was extracted)
    // Also wrapped in try/catch: recording failure must not affect the login response.
    //
    // Better Auth returns HTTP 401 for invalid credentials when used with Hono
    // (issue #7035 is Elysia.js-specific, not applicable here). The primary
    // detection is response.status !== 200. The body check below is a defensive
    // safety net in case a future Better Auth update changes this behavior.
    // T-001 MUST verify the actual status code empirically.
    if (email) {
        try {
            let isLoginSuccess = response.status === 200;

            // Better Auth may return 200 with error in body (issue #7035).
            // Clone the response to read the body without consuming it.
            if (isLoginSuccess) {
                try {
                    const clonedResponse = response.clone();
                    const responseBody = await clonedResponse.json();
                    // Defensive safety net: check for error in body (unlikely with Hono, but future-proof)
                    if (responseBody?.error || responseBody?.code === 'INVALID_EMAIL_OR_PASSWORD') {
                        isLoginSuccess = false;
                    }
                } catch {
                    // If body parse fails, trust the HTTP status code
                }
            }

            if (isLoginSuccess) {
                await resetLockout({ email });
                auditLog({
                    auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                    email,
                    ip: getClientIp({ c }),
                });
            } else {
                const result = await recordFailedAttempt({ email });
                auditLog({
                    auditEvent: AuditEventType.AUTH_LOGIN_FAILED,
                    email,
                    ip: getClientIp({ c }),
                    reason: 'invalid_credentials',
                    attemptNumber: result.attemptNumber,
                    locked: result.locked,
                });
            }
        } catch (lockoutError) {
            apiLogger.warn({ email, error: lockoutError }, 'Failed to record lockout attempt');
        }
    }

    return response;
});

// Catch-all for all other Better Auth routes (MUST come AFTER specific routes)
app.on(['GET', 'POST'], '/*', (c) => {
    const auth = getAuth();
    return auth.handler(c.req.raw);
});
```

**Critical implementation notes**:

- The specific `app.post('/sign-in/email', ...)` route MUST be registered BEFORE the catch-all `app.on(['GET', 'POST'], '/*', ...)`. In Hono, routes are matched in registration order.. the catch-all `/*` matches everything, so any route registered after it would never execute
- Use `c.req.raw.clone()` to clone the request. Forward `c.req.raw` (the original, unread) to Better Auth
- Handle body parse errors gracefully (let Better Auth handle malformed requests)
- If email extraction fails, the request passes through without lockout protection (degraded but functional)
- **All lockout operations are wrapped in try/catch**: If `checkLockout()`, `recordFailedAttempt()`, or `resetLockout()` throw (e.g., unexpected Redis error not caught by fallback), the login flow continues normally. Lockout is a protective layer, not a gate.. it must never break authentication
- The audit log calls for `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, and `AUTH_LOCKOUT` are included directly (not as TODOs) because T-009 should be implemented first or in parallel with T-006. If T-009 is not yet done when T-006 is implemented, temporarily comment out the auditLog imports and calls with `// TODO(T-009): uncomment when audit-logger is created`
- The response body is read via `response.clone()` as a defensive safety net. Better Auth returns 401 for invalid credentials with Hono (issue #7035 is Elysia.js-specific), so the primary detection is `response.status !== 200`. The body check guards against future Better Auth changes. The original response is returned as-is to the client. The clone is necessary because reading the body consumes the stream
- **T-001 must verify empirically** that Better Auth returns 401 (expected) for invalid credentials. Document the exact status code and response body structure

**T-007: Write unit tests for auth-lockout store** (complexity: 3)

Create `apps/api/test/middlewares/auth-lockout.test.ts`.

Tests to implement (using unit test config `vitest.config.ts`, mock Redis and logger):

1. `it('should allow login when no previous failed attempts')` - `checkLockout` returns `{ locked: false, retryAfter: 0 }`
2. `it('should allow login when failed attempts are below threshold')` - Record 4 attempts, `checkLockout` returns `{ locked: false }`
3. `it('should lock account after reaching threshold')` - Record 5 attempts, `checkLockout` returns `{ locked: true, retryAfter: <remaining-seconds> }`
4. `it('should return correct retryAfter in seconds')` - Record 5 attempts, verify `retryAfter` matches remaining window time
5. `it('should unlock account after window expires')` - Record 5 attempts, advance time past window (use `vi.advanceTimersByTime()`), `checkLockout` returns `{ locked: false }`
6. `it('should reset counter on successful login')` - Record 3 attempts, call `resetLockout`, `checkLockout` returns `{ locked: false }` and next `recordFailedAttempt` returns `{ attemptNumber: 1 }`
7. `it('should use Redis store when HOSPEDA_REDIS_URL is set')` - Mock `getRedisClient()` to return a mock Redis client, verify `redis.get()` and `redis.set()` are called with correct key pattern `lockout:<email>`
8. `it('should fall back to in-memory store when Redis unavailable')` - Mock `getRedisClient()` to return `undefined`, verify in-memory Map is used, verify `apiLogger.warn()` is called
9. `it('should normalize email to lowercase')` - Record attempt for `User@Example.COM`, check lockout for `user@example.com`, verify they share the same counter
10. `it('should track attempt number correctly')` - Record 3 attempts, verify `recordFailedAttempt` returns `{ attemptNumber: 3 }` on the third call

**Mock setup**:

```typescript
vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn(),
}));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
```

Use `vi.useFakeTimers()` for time-dependent tests. Call `vi.useRealTimers()` in `afterEach`. Call `clearLockoutStore()` and `resetLockoutStore()` in `beforeEach` to reset state between tests.

**T-008: Write integration test for login lockout flow** (complexity: 4)

Create `apps/api/test/integration/auth/auth-lockout.test.ts`.

This test requires the E2E test setup (`vitest.config.e2e.ts`).

**Test env configuration**: Set env vars at the top of the file, BEFORE app imports:

```typescript
process.env.HOSPEDA_AUTH_LOCKOUT_WINDOW_MS = '1000'; // 1 second (short for testing)
process.env.HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS = '5';
```

Use 1000ms window (not 500ms) to provide sufficient margin for CI environments. The wait time in tests should be at least 1.5x the window (1500ms).

**App and test setup**:

```typescript
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { clearLockoutStore } from '../../../src/middlewares/auth-lockout';

let app: AppOpenAPI;

beforeAll(() => {
    validateApiEnv();
    app = initApp();
});
```

**Test user creation**: Create test user in `beforeAll` via Better Auth signup API (see pattern in section 2.1). Use a unique email with timestamp to avoid conflicts across test runs:

```typescript
const testEmail = `test-lockout-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
```

Clean lockout state in `afterEach` via `clearLockoutStore()`.

Tests to implement:

1. `it('should allow login with correct credentials when not locked')` - Sign in with valid credentials, assert 200
2. `it('should return 429 after 5 failed login attempts')` - Send 5 requests with wrong password for same email, send 6th request (even with correct password), assert 429 with `ACCOUNT_LOCKED` code
3. `it('should include Retry-After header in lockout response')` - After lockout, verify response has `Retry-After` header with a positive integer
4. `it('should unlock after window expires')` - Trigger lockout, wait 1500ms (`await new Promise(r => setTimeout(r, 1500))`), send login with correct password, assert 200
5. `it('should reset counter after successful login')` - Send 3 failed attempts, send 1 successful attempt, send 3 more failed attempts, verify NOT locked (counter was reset by the success)
6. `it('should not count Better Auth rate limit 429 as a failed attempt')` - Send 4+ login requests rapidly within 10 seconds (to trigger Better Auth's built-in rate limiter at 3 req/10s), verify the response is 429, then wait 10 seconds and send a login with correct password, verify it succeeds (NOT locked out). This confirms that Better Auth's 429 responses are not counted as failed login attempts by the lockout handler
7. `it('should not affect other auth routes')` - During lockout for an email, verify `POST /api/auth/sign-up/email` and `POST /api/auth/forget-password` still work normally (not blocked). Note: Better Auth uses `forget-password` (NOT `forgot-password`). The frontend pages are named `forgot-password.astro` (URL path) but the Better Auth API endpoint is `forget-password`. Verify exact paths in T-001.

   ```typescript
   // Verify forget-password still works during lockout
   const fpRes = await app.request('/api/auth/forget-password', {
       method: 'POST',
       headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
       body: JSON.stringify({ email: testEmail }),
   });
   // Better Auth returns 200 even if email doesn't exist (prevents enumeration)
   expect(fpRes.status).not.toBe(429);

   // Verify signup still works during lockout (use a different email)
   const signupRes = await app.request('/api/auth/sign-up/email', {
       method: 'POST',
       headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
       body: JSON.stringify({
           email: `test-lockout-signup-${Date.now()}@example.com`,
           password: 'TestPassword123!',
           name: 'Lockout Signup Test',
       }),
   });
   expect(signupRes.status).not.toBe(429);
   ```

---

#### Phase 3: Audit Logging (4 tasks)

**T-009: Create audit-logger utility** (complexity: 3)

Create `apps/api/src/utils/audit-logger.ts`.

```typescript
import { logger, LoggerColors } from '@repo/logger';

// Register a dedicated AUDIT category
const auditLogger = logger.registerCategory('AUDIT', 'AUDIT', {
    color: LoggerColors.RED,
});

// Define audit event types as a const for type safety
export const AuditEventType = {
    AUTH_LOGIN_FAILED: 'auth.login.failed',
    AUTH_LOGIN_SUCCESS: 'auth.login.success',
    AUTH_LOCKOUT: 'auth.lockout',
    ACCESS_DENIED: 'access.denied',
    BILLING_MUTATION: 'billing.mutation',
    PERMISSION_CHANGE: 'permission.change',
    SESSION_SIGNOUT: 'session.signout',
} as const;

export type AuditEventTypeValue = (typeof AuditEventType)[keyof typeof AuditEventType];

// Base fields present in every audit entry
interface BaseAuditEntry {
    readonly auditEvent: AuditEventTypeValue;
    readonly timestamp?: string; // ISO-8601, auto-generated if omitted
}

// Event-specific entry types
interface AuthLoginFailedEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_LOGIN_FAILED;
    readonly email: string;
    readonly ip: string;
    readonly reason: string;
    readonly attemptNumber: number;
    readonly locked: boolean;
}

interface AuthLoginSuccessEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_LOGIN_SUCCESS;
    readonly email: string;
    readonly ip: string;
}

interface AuthLockoutEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_LOCKOUT;
    readonly email: string;
    readonly ip: string;
    readonly attemptNumber: number;
    readonly retryAfter: number;
}

interface AccessDeniedEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.ACCESS_DENIED;
    readonly actorId: string; // 'anonymous' for guests
    readonly actorRole: string; // 'guest' for unauthenticated
    readonly resource: string; // Request path
    readonly method: string; // HTTP method
    readonly statusCode: number; // 401 or 403
    readonly reason: string;
    readonly requiredPermissions?: readonly string[];
}

interface BillingMutationEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.BILLING_MUTATION;
    readonly actorId: string;
    readonly action: 'create' | 'update' | 'delete';
    readonly resourceType: string;
    readonly resourceId: string;
}

interface PermissionChangeEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.PERMISSION_CHANGE;
    readonly actorId: string;
    readonly targetUserId: string;
    readonly changeType: 'role_assignment' | 'permission_grant' | 'permission_revoke';
    readonly oldValue: string;
    readonly newValue: string;
}

interface SessionSignoutEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.SESSION_SIGNOUT;
    readonly actorId: string;
    readonly ip: string;
}

// Union type of all audit entries
export type AuditEntry =
    | AuthLoginFailedEntry
    | AuthLoginSuccessEntry
    | AuthLockoutEntry
    | AccessDeniedEntry
    | BillingMutationEntry
    | PermissionChangeEntry
    | SessionSignoutEntry;

// Sensitive data patterns to scrub (top-level field names only)
const SENSITIVE_PATTERNS = /password|token|secret|session_id|cookie|authorization|credential/i;

function scrubSensitiveData(entry: Record<string, unknown>): Record<string, unknown> {
    // Shallow copy - safe to mutate locally without affecting the original entry
    const scrubbed = { ...entry };
    for (const key of Object.keys(scrubbed)) {
        if (SENSITIVE_PATTERNS.test(key)) {
            scrubbed[key] = '[REDACTED]';
        }
    }
    return scrubbed;
}

/** Write a structured audit log entry. Timestamp is auto-generated if not provided. */
export function auditLog(entry: AuditEntry): void {
    const fullEntry = {
        ...entry,
        timestamp: entry.timestamp ?? new Date().toISOString(),
    };
    const scrubbed = scrubSensitiveData(fullEntry as unknown as Record<string, unknown>);
    auditLogger.info(scrubbed, `AUDIT:${entry.auditEvent}`);
}
```

**Key design decisions**:

- Uses `logger.registerCategory()` (the logger has categories, not channels)
- Each event type has a TypeScript interface for type safety (all 7 event types have interfaces)
- `scrubSensitiveData()` checks top-level field names only (documented limitation)
- `auditLog()` accepts a discriminated union type.. the compiler enforces correct fields per event type
- Timestamp defaults to `new Date().toISOString()` but can be overridden for testing

**T-010a: Add audit log calls to authorization middleware** (complexity: 2)

**IMPORTANT: Before implementing, read section 2.3 (Important Codebase Conventions for Implementors) for import rules and type conventions.**

Modify `apps/api/src/middlewares/authorization.ts` to add `auditLog()` calls.

**Import to add:**

| File | Import to add | Notes |
|------|--------------|-------|
| `authorization.ts` | `import { auditLog, AuditEventType } from '../utils/audit-logger';` | New import |

**1. Authorization middleware** (`apps/api/src/middlewares/authorization.ts`):

Add `import { auditLog, AuditEventType } from '../utils/audit-logger';` at the top.

At each `apiLogger.warn()` call where access is denied, add an `auditLog()` call immediately after. There are **6 denial points** (search for `apiLogger.warn(` in the file to locate them):

```typescript
// Line ~89 (system actor rejected from HTTP context)
apiLogger.warn('System actor rejected from HTTP context');
auditLog({
    auditEvent: AuditEventType.ACCESS_DENIED,
    actorId: 'system',
    actorRole: 'system',
    resource: c.req.path,
    method: c.req.method,
    statusCode: 403,
    reason: 'system_actor_in_http_context',
});

// Line ~106 (guest on protected route)
apiLogger.warn('Unauthorized access attempt to protected route by guest actor');
auditLog({
    auditEvent: AuditEventType.ACCESS_DENIED,
    actorId: 'anonymous',
    actorRole: 'guest',
    resource: c.req.path,
    method: c.req.method,
    statusCode: 401,
    reason: 'unauthenticated_on_protected_route',
});

// Line ~115 (insufficient permissions on protected)
apiLogger.warn(`Forbidden: Actor ${actor.id} lacks required permissions for protected route`);
auditLog({
    auditEvent: AuditEventType.ACCESS_DENIED,
    actorId: actor.id,
    actorRole: actor.role,
    resource: c.req.path,
    method: c.req.method,
    statusCode: 403,
    reason: 'insufficient_permissions',
    requiredPermissions: requiredPermissions, // from middleware config
});

// Line ~132 (guest on admin route) - same pattern as line ~106 but for admin
// Line ~140 (no admin access) - same pattern as line ~115
// Line ~149 (insufficient admin permissions) - same pattern as line ~115
```

**2. Auth lockout handler** (from T-006):

The audit log calls are already included in the T-006 code above:

- On failed login (after `recordFailedAttempt`): emits `AuditEventType.AUTH_LOGIN_FAILED`
- On successful login (after `resetLockout`): emits `AuditEventType.AUTH_LOGIN_SUCCESS`
- On lockout triggered (when returning 429): emits `AuditEventType.AUTH_LOCKOUT`

---

**T-010b: Add audit log calls to billing admin routes** (complexity: 3)

**IMPORTANT: Before implementing, read section 2.3 (Important Codebase Conventions for Implementors) for import rules and type conventions.**

Modify 3 billing admin route files to add `auditLog()` calls after mutations.

**3. Billing admin mutations** (3 files):

**Consolidated imports to add per file:**

| File | Imports to add |
|------|---------------|
| `promo-codes.ts` | `import { auditLog, AuditEventType } from '../../utils/audit-logger';` (Note: `getActorFromContext` already imported from `../../middlewares/actor`) |
| `settings.ts` | `import { auditLog, AuditEventType } from '../../utils/audit-logger';` (Note: `getActorFromContext` already imported) |
| `trial.ts` | `import { auditLog, AuditEventType } from '../../utils/audit-logger';` AND `import { getActorFromContext } from '../../middlewares/actor';` (NOT currently imported) |

**Exact `resourceId` values per mutation:**

| Route | action | resourceType | resourceId |
|-------|--------|-------------|------------|
| `createPromoCodeRoute` | `'create'` | `'promo_code'` | `result.data.id` (from service response) |
| `updatePromoCodeRoute` | `'update'` | `'promo_code'` | `params.id as string` |
| `deletePromoCodeRoute` | `'delete'` | `'promo_code'` | `params.id as string` |
| `updateBillingSettingsRoute` | `'update'` | `'billing_settings'` | `'global'` |
| `resetBillingSettingsRoute` | `'update'` | `'billing_settings'` | `'default'` |
| `extendTrialRoute` | `'update'` | `'trial'` | `subscriptionId` |
| `checkExpiryRoute` | `'update'` | `'trial_expiry_check'` | `'batch'` |

**In `apps/api/src/routes/billing/promo-codes.ts`:**

**IMPORTANT**: The handlers currently mark the context parameter as unused with `_c` prefix. Here are the exact current signatures and what to change (locate each handler by searching for `handler: async`):

| Route | Current signature | Change to |
|-------|-------------------|-----------|
| `createPromoCodeRoute` | `async (_c, _params, body)` | `async (c, _params, body)` (only `_c` -> `c`, keep `_params` as unused) |
| `updatePromoCodeRoute` | `async (_c, params, body)` | `async (c, params, body)` (only `_c` -> `c`, `params` already has no `_`) |
| `deletePromoCodeRoute` | `async (_c, params)` | `async (c, params)` (only `_c` -> `c`, `params` already has no `_`) |

For each handler:

1. Rename `_c` to `c` in the handler signature
2. Add `const actor = getActorFromContext(c);` at the start of each handler (`getActorFromContext` is already imported from `../../middlewares/actor`)
3. Add `auditLog()` call after the successful service operation

Example for `createPromoCodeRoute` (apply same pattern to update and delete):

```typescript
// Change handler signature from: async (_c, _params, body) =>
// To: async (c, _params, body) =>
handler: async (c, _params, body) => {
    const actor = getActorFromContext(c);
    const service = new PromoCodeService();
    // ... existing service call ...
    // After successful result:
    auditLog({
        auditEvent: AuditEventType.BILLING_MUTATION,
        actorId: actor.id,
        action: 'create',
        resourceType: 'promo_code',
        resourceId: result.data.id,
    });
    return result.data;
}
```

**In `apps/api/src/routes/billing/settings.ts`:**

**NOTE**: This file already has `apiLogger.info()` calls with audit-like data (`actorId`, `updatedFields`) in the update and reset handlers. These are operational logs. ADD the `auditLog()` calls alongside them (do NOT replace the existing `apiLogger.info()` calls). The `auditLog()` calls use the dedicated `AUDIT` category for structured security audit trail, while `apiLogger.info()` remains for general operational logging. Search for `apiLogger.info(` to locate the exact insertion points.

- After the `apiLogger.info()` in the update handler: emit `BILLING_MUTATION` with `action: 'update'`, `resourceType: 'billing_settings'`, `resourceId: 'global'`, `actorId: actorId ?? 'unknown'`
- After the `apiLogger.info()` in the reset handler: emit `BILLING_MUTATION` with `action: 'update'`, `resourceType: 'billing_settings'`, `resourceId: 'default'`, `actorId: actorId ?? 'unknown'`

Note: `actor` and `actorId` are already extracted in both handlers (search for `getActorFromContext`).

**In `apps/api/src/routes/billing/trial.ts`:**

**NOTE**: `getActorFromContext` is NOT currently imported in this file. Add the import.

- In `extendTrialRoute` handler (search for `handler: async (c, _params, body)` near the `extendTrialRequestSchema` usage, handler signature is `async (c, _params, body)`): Add `const actor = getActorFromContext(c);` after the billing check (`if (!billingEnabled)`). After the successful `trialService.extendTrial()` result (before the return), emit `BILLING_MUTATION` with `actorId: actor.id`, `action: 'update'`, `resourceType: 'trial'`, `resourceId: subscriptionId`
- In `handleCheckExpiry` function (search for `export const handleCheckExpiry = async (`, this is a standalone exported function with param `c` typed as `Parameters<Parameters<typeof createAdminRoute>[0]['handler']>[0]`): Add `const actor = getActorFromContext(c);` at the start, after the billing check. After the successful `trialService.blockExpiredTrials()` result (before the return), emit `BILLING_MUTATION` with `actorId: actor.id`, `action: 'update'`, `resourceType: 'trial_expiry_check'`, `resourceId: 'batch'`

---

**T-010c: Add audit log calls to user admin routes and signout** (complexity: 3)

**IMPORTANT: Before implementing, read section 2.3 (Important Codebase Conventions for Implementors) for import rules, `ServiceOutput<T>` type, and `transformApiInputToDomain()` behavior.**

Modify 3 files: `update.ts`, `patch.ts` (permission change audit), and `signout.ts` (session signout audit).

**Imports to add:**

| File | Import to add | Notes |
|------|--------------|-------|
| `update.ts` | `import { auditLog, AuditEventType } from '../../../utils/audit-logger';` | `getActorFromContext` already imported from `../../../utils/actor` |
| `patch.ts` | `import { auditLog, AuditEventType } from '../../../utils/audit-logger';` | `getActorFromContext` already imported from `../../../utils/actor` |
| `signout.ts` | `import { auditLog, AuditEventType } from '../../utils/audit-logger';` | New import |

**4. User admin routes** (2 files) - **Permission change audit (MUST implement, not defer)**:

`UserUpdateInputSchema` and `UserPatchInputSchema` already include `role: RoleEnumSchema` and `permissions: z.array(PermissionEnumSchema)` (inherited from `UserSchema`). The audit call MUST be implemented now.

In `apps/api/src/routes/user/admin/update.ts` and `patch.ts`:

```typescript
import { auditLog, AuditEventType } from '../../../utils/audit-logger';

// BEFORE the update call, fetch the current user to get old values.
// API: userService.getById(actor, id) returns Promise<ServiceOutput<User | null>>
// The userService instance already exists at module level in both files (search for `new UserService`).
const prevResult = await userService.getById(actor, id as string);
const previousUser = prevResult.data;

// ... existing update call ...
const result = await userService.update(actor, id as string, userData);

// After successful result (only if we have previous user data for comparison):
if (result.data && previousUser) {
    // Check for role change
    if (userData.role !== undefined && userData.role !== previousUser.role) {
        auditLog({
            auditEvent: AuditEventType.PERMISSION_CHANGE,
            actorId: actor.id,
            targetUserId: id,
            changeType: 'role_assignment',
            oldValue: previousUser.role,
            newValue: userData.role,
        });
    }

    // Check for permissions change
    if (userData.permissions !== undefined) {
        const oldPerms = (previousUser.permissions ?? []).sort().join(',');
        const newPerms = (userData.permissions ?? []).sort().join(',');
        if (oldPerms !== newPerms) {
            // Determine if permissions were added or removed
            const added = userData.permissions.filter(
                (p: string) => !previousUser.permissions?.includes(p)
            );
            const removed = (previousUser.permissions ?? []).filter(
                (p: string) => !userData.permissions?.includes(p)
            );

            if (added.length > 0) {
                auditLog({
                    auditEvent: AuditEventType.PERMISSION_CHANGE,
                    actorId: actor.id,
                    targetUserId: id,
                    changeType: 'permission_grant',
                    oldValue: oldPerms,
                    newValue: newPerms,
                });
            }
            if (removed.length > 0) {
                auditLog({
                    auditEvent: AuditEventType.PERMISSION_CHANGE,
                    actorId: actor.id,
                    targetUserId: id,
                    changeType: 'permission_revoke',
                    oldValue: oldPerms,
                    newValue: newPerms,
                });
            }
        }
    }
}
```

**Important**: To get `previousUser`, add `userService.getById(actor, id as string)` BEFORE the update operation. The API is `getById(actor: Actor, id: string): Promise<ServiceOutput<TEntity | null>>`. This adds one DB read per admin user update, which is acceptable for low-volume admin operations. If `prevResult.data` is `null` (user not found), skip audit logging.. the subsequent `update()` call will fail anyway.

**For `patch.ts`**: The same pattern applies, but note that `patch.ts` uses `transformApiInputToDomain(body)` to create `domainInput` (search for `transformApiInputToDomain` in the file). Check `domainInput.role` and `domainInput.permissions` (not `body.role`/`body.permissions`) for the comparison.

**5. Signout route** (`apps/api/src/routes/auth/signout.ts`):

Add `import { auditLog, AuditEventType } from '../../utils/audit-logger';` at the top.

**IMPORTANT - Variable scoping**: In the current `signout.ts` code, `ip` is only defined inside the second `if (userId)` block (search for `const ip = getClientIp`). It is NOT available outside that block. To use `ip` in the audit log for all cases (including when userId is undefined), extract `ip` BEFORE the `if (userId)` blocks:

```typescript
// Move ip extraction OUTSIDE the if blocks (add after `let cacheCleared = false;`, before the first `if (userId)`)
const ip = getClientIp({ c });

// ... existing code for cache invalidation and rate limit clearing ...
// The existing `clearRateLimitForIp({ ip })` call inside `if (userId)` now uses the same `ip` variable

// Add audit log BEFORE the return statement (after the second `if (userId)` block closes):
auditLog({
    auditEvent: AuditEventType.SESSION_SIGNOUT,
    actorId: userId ?? 'anonymous',
    ip,
});
```

The refactored handler flow becomes:

1. Extract `user`, `userId`, `cacheCleared`, and `ip` at the top of the handler
2. Existing cache invalidation logic (`if (userId) { userCache.invalidate(...) }`)
3. Existing rate limit clearing (`if (userId) { await clearRateLimitForIp({ ip }) }`) - remove the `const ip = getClientIp({ c })` line from inside this block since `ip` is now defined above
4. **NEW**: `auditLog()` call (outside the `if (userId)` block, so it logs even anonymous signouts)
5. Existing return statement

Note: `getClientIp({ c })` is already imported from `../../middlewares/rate-limit` (search for `import { clearRateLimitForIp, getClientIp }` at the top of `signout.ts`).

**T-011: Write unit tests for audit logger** (complexity: 2)

Create `apps/api/test/utils/audit-logger.test.ts`.

Tests to implement:

1. `it('should create structured entry with all required fields for auth.login.failed')` - Call `auditLog()` with an `AUTH_LOGIN_FAILED` entry, verify the mock auditLogger `.info()` was called with correct fields
2. `it('should create structured entry for access.denied')` - Same for `ACCESS_DENIED`
3. `it('should create structured entry for billing.mutation')` - Same for `BILLING_MUTATION`
4. `it('should create structured entry for permission.change')` - Same for `PERMISSION_CHANGE`
5. `it('should create structured entry for auth.lockout')` - Same for `AUTH_LOCKOUT`
6. `it('should create structured entry for session.signout')` - Same for `SESSION_SIGNOUT`
7. `it('should create structured entry for auth.login.success')` - Same for `AUTH_LOGIN_SUCCESS`
8. `it('should generate ISO-8601 timestamp when not provided')` - Call without explicit timestamp, verify output has valid ISO timestamp
9. `it('should scrub sensitive field names from entries')` - Pass entry with a field named `password` or `token`, verify it appears as `[REDACTED]`
10. `it('should NOT scrub non-sensitive fields')` - Verify `email`, `actorId`, `resource` etc. are preserved as-is
11. `it('should use AUDIT logger category')` - Verify the `auditLogger.info()` mock is called (not `apiLogger`)
12. `it('should set actorId to anonymous for unauthenticated events')` - Verify guest actor entries use `'anonymous'` as actorId

**Mock setup**: Mock `@repo/logger` to capture calls to the registered category:

```typescript
const mockAuditInfo = vi.fn();
vi.mock('@repo/logger', () => ({
    logger: {
        registerCategory: vi.fn(() => ({
            info: mockAuditInfo,
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        })),
    },
    LoggerColors: { RED: 'RED' },
    LogLevel: { INFO: 'INFO' },
}));
```

**T-012: Write integration test for audit log production** (complexity: 3)

Create `apps/api/test/integration/audit/audit-logging.test.ts`.

**IMPORTANT**: The E2E/integration test config (`vitest.config.e2e.ts`) does NOT include `test/setup.ts` as a setup file. Therefore, `@repo/logger` is NOT globally mocked in integration tests. The test must set up its own mocking strategy.

**Approach**: Use `vi.mock()` at the top of the test file to mock `@repo/logger` and capture the AUDIT category mock. Then use `vi.spyOn()` or direct mock access to verify audit calls.

```typescript
// Mock @repo/logger BEFORE any app imports
const mockAuditLoggerInfo = vi.fn();
const mockRegisterCategory = vi.fn((name: string) => {
    // Return a specific mock for the AUDIT category
    return {
        info: name === 'AUDIT' ? mockAuditLoggerInfo : vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn(),
    };
});

vi.mock('@repo/logger', () => ({
    logger: {
        registerCategory: mockRegisterCategory,
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        })),
        registerLogMethod: vi.fn().mockReturnThis(),
    },
    default: { registerCategory: mockRegisterCategory },
    createLogger: vi.fn(),
    LoggerColors: { RED: 'RED', BLUE: 'BLUE', GREEN: 'GREEN', YELLOW: 'YELLOW' },
    LogLevel: { LOG: 'LOG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' },
}));

// NOW import the app (after mocks are set up)
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
```

Tests to implement (E2E config, real app with mocked logger):

1. `it('should produce audit entry when guest accesses protected route')` - Make unauthenticated request to a protected endpoint, verify `mockAuditLoggerInfo` was called with `expect.objectContaining({ auditEvent: 'access.denied' })`
2. `it('should produce audit entry when authenticated user lacks permissions')` - Make authenticated request (with session cookie) to an admin endpoint that the user lacks permissions for, verify `access.denied` audit entry
3. `it('should produce audit entry on failed login')` - Send login request with wrong password, verify `auth.login.failed` audit entry with correct email

```typescript
// After making a request that triggers an audit event:
expect(mockAuditLoggerInfo).toHaveBeenCalledWith(
    expect.objectContaining({ auditEvent: 'access.denied' }),
    expect.stringContaining('AUDIT:access.denied')
);
```

**Note**: Clear `mockAuditLoggerInfo` in `beforeEach` with `mockAuditLoggerInfo.mockClear()` to isolate test assertions.

**Mock category registration order**: The `registerCategory` mock will be called multiple times: first for `'API'` category (from `apps/api/src/utils/logger.ts` which creates `apiLogger`), then for `'AUDIT'` category (from `audit-logger.ts`). The mock above handles this correctly by returning `mockAuditLoggerInfo` only when `name === 'AUDIT'`, and a generic `vi.fn()` for all other categories.

---

#### Phase 4: Session Invalidation Tests (2 tasks)

**T-013: Write integration tests for session invalidation on signout** (complexity: 4)

Create `apps/api/test/integration/auth/signout-session.test.ts`.

This test requires the E2E test setup with `TestDatabaseManager` because it queries the `session` DB table directly.

**Test setup**:

```typescript
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { sessions, eq } from '@repo/db';

let app: AppOpenAPI;

beforeAll(async () => {
    validateApiEnv();
    app = initApp();
    await testDb.setup();
});

afterAll(async () => {
    await testDb.teardown();
});
```

Create a test user in `beforeAll` via Better Auth signup API. Use a unique email with timestamp to avoid conflicts:

```typescript
const testEmail = `test-signout-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
```

**Cleanup note**: Test users created via Better Auth signup are persisted in the test database. The `testDb.teardown()` in `afterAll` handles connection cleanup. If test user accumulation becomes an issue across runs, add explicit cleanup via `await db.delete(users).where(eq(users.email, testEmail))` in `afterAll` (import `users` from `@repo/db`). The same applies to session records.

Import `sessions` table schema from `@repo/db` for direct queries. Note: the export is `sessions` (plural), defined in `packages/db/src/schemas/user/session.dbschema.ts` as `export const sessions = pgTable('session', ...)`.

**Extracting `testUserId`** (needed for direct DB queries on the `sessions` table):

```typescript
const signupBody = await signupRes.json();
const testUserId = signupBody.user.id; // Better Auth signup response includes { user: { id, email, name, ... } }
```

```typescript
// Helper to sign in and get session cookie
async function signIn(email: string, password: string, userAgent = 'vitest') {
    const res = await app.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': userAgent },
        body: JSON.stringify({ email, password }),
    });
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    return { response: res, cookie };
}
```

Tests to implement:

1. `it('should delete session record from DB on signout')`:
   - Sign in, extract session cookie
   - Query `sessions` table for the user's session, verify it exists
   - Sign out (POST to `/api/auth/sign-out` with session cookie)
   - Query `sessions` table again, verify session is deleted

2. `it('should reject old session token after signout')`:
   - Sign in, extract session cookie
   - Make authenticated request (e.g., `GET /api/v1/protected/users/me`), verify 200
   - Sign out
   - Make same request with old cookie, verify 401 or guest actor response

3. `it('should clear session cookie in signout response')`:
   - Sign in, extract session cookie
   - Sign out
   - Check `Set-Cookie` header in signout response for `better-auth.session_token` with past expiry or `Max-Age=0`

4. `it('should clear rate limit and cache via Hospeda cleanup route')`:
   - Sign in, extract session cookie
   - **IMPORTANT**: Call `POST /api/v1/auth/signout` (Hospeda) BEFORE calling `POST /api/auth/sign-out` (Better Auth). The Hospeda endpoint has `skipAuth: true` but reads `c.get('user')` from the auth middleware to get the userId. If Better Auth's signout is called first, the session is deleted and `c.get('user')` returns `undefined`, causing `cacheCleared` to be `false`. To test `cacheCleared: true`, the user session must still be valid when the Hospeda endpoint is called.
   - Call `POST /api/v1/auth/signout` with session cookie
   - Verify response body contains `cacheCleared: true`

5. `it('should handle signout for already-expired session gracefully on Better Auth endpoint')`:
   - Sign in, extract session cookie
   - Manually delete the session from DB (via `testDb.getDb()`)
   - Call `POST /api/auth/sign-out` (Better Auth), verify it does NOT throw 500

6. `it('should handle signout for already-expired session gracefully on Hospeda endpoint')`:
   - Sign in, extract session cookie
   - Manually delete the session from DB (via `testDb.getDb()`)
   - Call `POST /api/v1/auth/signout` (Hospeda cleanup), verify it does NOT throw 500

**DB query pattern**:

```typescript
const db = testDb.getDb();
const userSessions = await db.select().from(sessions).where(eq(sessions.userId, testUserId));
```

**T-014: Verify signout flow with multiple sessions** (complexity: 3)

Add to `signout-session.test.ts` or create a separate describe block:

1. `it('should only delete the current session, not all user sessions')`:
   - Sign in from "browser A" (get cookie A) - use `'vitest-browser-a'` as user-agent
   - Sign in from "browser B" (get cookie B) - use `'vitest-browser-b'` as user-agent
   - Sign out with cookie A
   - Verify: session A deleted, session B still active
   - Make request with cookie B, verify still authenticated

2. `it('should handle concurrent signout requests gracefully')`:
   - Sign in, get cookie
   - Send two signout requests simultaneously (`Promise.all`)
   - Verify both return success (no 500 errors)

---

#### Phase 5: Verification (2 tasks)

**T-015: Run full test suite and verify zero regressions** (complexity: 2)

Run the following commands and verify all pass:

```bash
cd apps/api
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

Also run from monorepo root:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Verify:

- All new test files are discovered and executed
- All new tests pass
- No existing tests are broken
- No new TypeScript errors
- No new Biome lint errors

**T-016: Update SPEC-019 notes and close SPEC-026** (complexity: 1)

1. Update `.claude/tasks/SPEC-019-security-permissions-hardening/TODOs.md` to add a cross-reference noting that security testing gaps identified in the SPEC-019 audit are addressed by SPEC-026
2. Update `.claude/specs/SPEC-026-security-testing-gaps/metadata.json` to set `status: "completed"` and `completed` date
3. Update `.claude/tasks/SPEC-026-security-testing-gaps/state.json` to mark all tasks as `completed`

**Phase commit strategy**: Each phase should be committed atomically only when ALL tasks in the phase are complete and passing. Do not commit a partially implemented phase (e.g., lockout handler without tests). If a phase is blocked, commit what is complete and document the blocker.

---

### 4. Dependencies

**External dependencies:**

- None new. Uses existing: `@repo/logger`, `ioredis` (via existing Redis client), Better Auth session API, `@qazuor/qzpay-hono` (already installed)

**Internal dependencies between tasks:**

```
Phase 1 (Webhook Tests):
  T-001 ─┬─ T-002
         └─ T-003

Phase 2 (Brute-Force):
  T-004 ── T-005 ─┬─ T-006 ─┐
                   └─ T-007 ─┤
                              └─ T-008

Phase 3 (Audit Logging):
  T-009 ─┬─ T-010a ─┐
          ├─ T-010b ─┤
          ├─ T-010c ─┤
          └─ T-011  ─┤
                      └─ T-012

Phase 4 (Session Tests):
  T-013 ── T-014

Phase 5 (Verification):
  All of T-002..T-014 ── T-015 ── T-016
```

**Cross-phase dependencies:**

- T-006 (lockout handler integration) imports from T-009 (audit logger) for audit log calls. **Recommended order**: implement T-009 before or in parallel with T-006. If T-006 is implemented first, temporarily comment out audit imports/calls with `// TODO(T-009): uncomment when audit-logger is created`
- T-010a, T-010b, T-010c can be implemented in parallel (different files, no conflicts between them)
- Phases 1, 2, 3, and 4 can be developed in parallel (different files, no conflicts)
- Phase 5 depends on ALL previous phases being complete

---

### 5. Testing Strategy

#### Unit Tests (fast, mocked, `vitest.config.ts`)

| Test File | What It Tests | Key Mocks |
|-----------|--------------|-----------|
| `test/middlewares/auth-lockout.test.ts` | Lockout logic: threshold, expiry, reset, Redis vs in-memory | Redis client, logger, timers |
| `test/utils/audit-logger.test.ts` | Audit entry structure, sensitive data scrubbing, category usage | `@repo/logger` |

#### Integration Tests (slower, real app, `vitest.config.e2e.ts`)

| Test File | What It Tests | Requirements |
|-----------|--------------|-------------|
| `test/integration/webhooks/webhook-signature.test.ts` | Webhook route signature verification | `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` in test env, `TestDatabaseManager` |
| `test/integration/webhooks/webhook-idempotency-full.test.ts` | Webhook idempotency with DB | `TestDatabaseManager`, `TEST_DB_URL` |
| `test/integration/auth/auth-lockout.test.ts` | Full lockout flow (5 fails -> locked -> unlock) | Test user, short lockout window (1000ms) |
| `test/integration/auth/signout-session.test.ts` | Session deletion, token rejection, cookie clearing | `TestDatabaseManager`, `TEST_DB_URL`, test user |
| `test/integration/audit/audit-logging.test.ts` | Audit entries produced on denial/failure | Custom `@repo/logger` mock (NOT from test/setup.ts) |

#### Test Environment Requirements

| Variable | Required For | Default / Notes |
|----------|-------------|-----------------|
| `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` | Webhook signature tests (T-002) | Must be set to force signature verification |
| `HOSPEDA_MERCADO_PAGO_SANDBOX` | All billing tests | `true` (test env default) |
| `TEST_DB_URL` | DB-dependent tests (T-002, T-003, T-013, T-014) | `postgresql://postgres:postgres@localhost:5432/hospeda_test` |
| `HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS` | Lockout integration test (T-008) | Set to `5` in test |
| `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS` | Lockout integration test (T-008) | Set to `1000` (1s) for fast tests with 1.5x margin |
| `HOSPEDA_REDIS_URL` | Optional for unit tests (in-memory fallback) | May be needed for Redis-specific integration tests |

---

### 6. Complexity Summary

| Task | Title | Complexity | Phase |
|------|-------|-----------|-------|
| T-001 | Analyze webhook route and QZPay integration | 2 | Webhook Tests |
| T-002 | Write integration tests for webhook signature handling | 4 | Webhook Tests |
| T-003 | Write integration tests for webhook idempotency with DB | 3 | Webhook Tests |
| T-004 | Add lockout env vars to ApiEnvSchema | 1 | Brute-Force |
| T-005 | Create auth-lockout store | 4 | Brute-Force |
| T-006 | Integrate lockout handler into auth handler | 4 | Brute-Force |
| T-007 | Write unit tests for auth-lockout store | 3 | Brute-Force |
| T-008 | Write integration test for login lockout flow | 4 | Brute-Force |
| T-009 | Create audit-logger utility | 3 | Audit Logging |
| T-010a | Add audit log calls to authorization middleware | 2 | Audit Logging |
| T-010b | Add audit log calls to billing admin routes | 3 | Audit Logging |
| T-010c | Add audit log calls to user admin routes and signout | 3 | Audit Logging |
| T-011 | Write unit tests for audit logger | 2 | Audit Logging |
| T-012 | Write integration test for audit log production | 3 | Audit Logging |
| T-013 | Write integration tests for session invalidation | 4 | Session Tests |
| T-014 | Verify signout flow with multiple sessions | 3 | Session Tests |
| T-015 | Run full test suite and verify zero regressions | 2 | Verification |
| T-016 | Update SPEC-019 notes and close SPEC-026 | 1 | Verification |

- **Total tasks**: 18
- **Total complexity points**: 51
- **Average complexity**: 2.8
- **Max complexity**: 4 (T-005: auth-lockout store with Redis/in-memory dual store, T-002/T-006/T-008/T-013)

---

### 7. Revision History

#### v10 Exhaustive External Audit (2026-03-10, Better Auth docs + MercadoPago docs + codebase cross-verified)

**Critical fix: Better Auth built-in rate limiter interaction (C2)**:

- Better Auth has its own rate limiter: 3 requests per 10 seconds for `/sign-in/email` (per-IP)
- The lockout handler receives Better Auth's 429 response from `auth.handler()`. Without a check, these would be counted as failed login attempts, causing false lockouts
- Added `response.status === 429` check in T-006 lockout handler code: returns 429 as-is without recording a failed attempt
- Added "Interaction with Better Auth rate limiter" section to US-02 background
- Added Known Limitation documenting the behavior
- Added test 6 to T-008: `'should not count Better Auth rate limit 429 as a failed attempt'`

**Critical fix: Wrong error code in lockout handler safety net (C1)**:

- T-006 code checked `responseBody?.code === 'INVALID_CREDENTIALS'` but Better Auth uses `'INVALID_EMAIL_OR_PASSWORD'`
- Fixed to match Better Auth's actual error code

**Fix: signout.ts references by line number replaced with text search (M1)**:

- Replaced `"line 36"`, `"line 25"`, `"line 27"`, `"line 38"` with search instructions (`search for "const ip = getClientIp"`, `add after "let cacheCleared = false;"`)
- Added explicit instruction to remove `const ip = getClientIp({ c })` from inside the `if (userId)` block

**Fix: trial.ts handler signatures verified (M2)**:

- Confirmed `extendTrialRoute` handler signature is `async (c, _params, body)` (not just `c`)
- Confirmed `handleCheckExpiry` is a standalone exported async function (not a handler inside createAdminRoute)
- Updated T-010b with exact search patterns for both handlers

#### v9 External Verification Audit (2026-03-09, QZPay source + Better Auth docs + MercadoPago docs verified)

**Clarification: Better Auth issue #7035 is Elysia.js-specific, not applicable to Hono**:

- Issue #7035 reports HTTP 200 with error in body, but this is caused by Elysia.js overwriting Response status codes, not a Better Auth bug
- Hono correctly preserves Response status codes, so Better Auth returns HTTP 401 with `INVALID_EMAIL_OR_PASSWORD` for invalid credentials
- Updated US-02 implementation approach, US-03 AC-01, risk assessment table, T-001, T-006 code comments, and critical notes
- The defensive body check code in T-006 is retained as a safety net but documented as unlikely to activate with Hono
- Risk entry probability reduced from Medium to Low, impact from High to Medium

**Verified QZPay v1.1.0 source code** (node_modules):

- Confirmed HMAC algorithm: `signedPayload = id:${extractId(body)};request-id:${ts};ts:${ts};`
- Confirmed `extractId()`: `parsed.data?.id ?? String(parsed.id)` (from body JSON, not URL params)
- Confirmed divergence from MercadoPago official docs: `request-id` uses timestamp (not `x-request-id` header UUID)
- Confirmed 401 rejection via webhook middleware, 300s replay window, `crypto.timingSafeEqual`
- Confirmed `verifySignature()` returns `true` when `webhookSecret` is undefined (signature skipped in sandbox)
- Confirmed double verification: middleware calls `verifySignature()`, then `constructEvent()` calls it again internally

#### v8 Exhaustive Audit (2026-03-10, code + node_modules + external docs verified)

**Critical fix: MercadoPago env vars required `HOSPEDA_` prefix**:

- All env vars in test setup blocks used unprefixed names (`MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_SANDBOX`)
- The billing adapter (`packages/billing/src/adapters/mercadopago.ts`) reads them via `getEnv('HOSPEDA_MERCADO_PAGO_*')` from `@repo/config`
- Fixed all 9 occurrences across T-002, T-003, US-01 background, AC-01, test env table, and integration test requirements table
- Without fix, `getQZPayBilling()` would return `null`, webhook router wouldn't mount, all tests would get 404

**Critical fix: Better Auth 200-with-error-body pattern (issue #7035)**:

- Better Auth may return HTTP 200 with error in response body instead of 4xx status codes
- Updated T-006 lockout handler to clone response and check body for error field alongside status check
- Updated T-001 to explicitly require empirical verification of Better Auth's response pattern
- Updated US-02 implementation approach, US-03 AC-01, and risk assessment table

**Fixed authorization.ts denial count in US-03 background**:

- Background text said "5 apiLogger.warn() calls" but there are 6 (system actor at line ~89 was missing)
- Updated to "6 denial points at lines ~89, ~106, ~115, ~132, ~140, ~149"

**Fixed signout.ts audit log scope issue (T-010c)**:

- `ip` variable was only defined inside `if (userId)` block, not accessible for audit log outside
- Clarified that `ip` extraction must be moved outside the `if` block for the audit log to work in all cases
- Added explicit refactoring instructions with line-by-line guidance

#### v7 Cross-Verification Audit (2026-03-09, code + external docs verified)

**Critical fix: Removed duplicate `client-ip.ts` creation**:

- `getClientIp({ c })` already exists and is exported from `apps/api/src/middlewares/rate-limit.ts` (line 244), already imported by `signout.ts`
- Removed `src/utils/client-ip.ts` from T-005 scope, architecture table, and file list
- Updated all imports in T-006 code from `../../utils/client-ip` to `../../middlewares/rate-limit`
- T-005 complexity reduced from 5 to 4; total complexity from 52 to 51

**Added missing denial point in T-010a**:

- `authorization.ts` has 6 denial points (not 5): added system actor rejection at line ~89

**Documented QZPay divergence from official MercadoPago docs**:

- QZPay v1.1.0 uses `timestamp` for `request-id` field (official docs specify `x-request-id` header UUID)
- QZPay extracts `id` from body JSON (official docs specify URL query parameter `data.id`)
- Added explicit warning in T-001 and T-002 that tests must match QZPay behavior, not official MP docs

**Fixed all line number references**:

- Replaced exact line numbers with search instructions (e.g., "search for `apiLogger.warn(`") throughout T-010a/b/c to prevent stale references
- Fixed authorization.ts line refs: 105→106, 114→115, 131→132, 139→140, 148→149
- Fixed routes/index.ts webhook mount: line 236→245
- Updated `getActorFromContext` behavior documentation (two implementations differ: one throws, one returns guest)

**Fixed signout.ts description**:

- IP extraction is NOT inline.. uses shared `getClientIp({ c })` from `rate-limit.ts`
- Updated Known Limitation: `getClientIp` respects `trustProxy` config (does not always trust proxy headers)

**Fixed logger mock range**: lines 62-82 → lines 62-119

#### v6 Exhaustive Audit and Task Decomposition (2026-03-06, codebase-verified)

**Task decomposition (C1)**:

- Split T-010 (complexity 6) into T-010a (complexity 2), T-010b (complexity 3), T-010c (complexity 3) to comply with atomic task ceiling of 4. Total tasks: 16 -> 18. Each sub-task modifies independent files with no cross-dependencies
- Updated dependency graphs, complexity summary, and architecture table

**Pre-documented HMAC algorithm (C2)**:

- Added complete QZPay webhook signature verification algorithm to T-001 and T-002, including: signed payload format (`id:<id>;request-id:<ts>;ts:<ts>;`), rejection status (401), replay window (300s), and TypeScript helper function for constructing test signatures
- Added T-001 item 6: verify `getQZPayBilling()` env var requirements (I3)

**Gap fixes**:

- **I2**: Added explicit payload examples for `forget-password` and `sign-up/email` in T-008 test 6
- **I4**: Added cross-reference to section 2.3 at the top of each T-010a/b/c sub-task
- **I5**: Added cleanup note for test users in T-013 (afterAll cleanup pattern)
- **M1**: Fixed `transformApiInputToDomain` description to mention recursive object/array handling
- **M3**: Clarified all T-006 imports are NEW (handler.ts currently only imports getAuth and createRouter)
- **M4**: Added `billingWebhookEvents` INSERT example for T-003 test 3 (failed event reprocessing)

#### Prior versions (condensed)

- **v5** (2026-03-06): Junior-ready audit. Fixed forget-password endpoint name. Added section 2.3 (codebase conventions). Added webhook route paths, billing env vars, unique test emails, promo-codes handler signatures, cacheCleared ordering note
- **v4** (2026-03-06): Exhaustive codebase verification. Documented `_c` handler params, settings.ts existing logging, trial.ts missing import, two `getActorFromContext` locations, `ServiceOutput<T>` type, patch.ts `transformApiInputToDomain`, signout.ts line references
- **v3** (2026-03-06): Critical fixes from codebase verification. UserSchemas already include role/permissions. E2E config lacks global logger mock. Added AUTH_LOGIN_SUCCESS and SESSION_SIGNOUT call sites. Fixed IP extraction to Hono API
- **v2** (2026-03-06): Fixed z.coerce pattern, added client-ip.ts utility, fixed billing audit targets, added missing interfaces, fixed getRedisClient signature, added test user seeding instructions

---

## Design Decisions

### DD-01: `HOSPEDA_AUTH_LOCKOUT_COOLDOWN_MS` intentionally discarded (GAP-004)

The original spec draft included a `HOSPEDA_AUTH_LOCKOUT_COOLDOWN_MS` environment variable to control a separate cooldown period after account lockout. During implementation, it was determined that `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS` (default: 900000ms / 15 minutes) serves both purposes: it defines the sliding window for counting failed attempts AND the lockout duration. A separate cooldown variable would introduce configuration confusion with no practical benefit, since the lockout naturally expires when the window resets. The variable was removed from the design and only `HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS` and `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS` are exposed as configurable env vars.

### DD-02: `SESSION_SIGNOUT` audit event naming (GAP-010)

The spec originally referenced `AUTH_LOGOUT_SUCCESS` as the audit event name for signout operations. During implementation, `SESSION_SIGNOUT` was chosen instead because: (1) it is more descriptive of the actual operation (session termination, not just authentication state change), (2) it aligns with the domain model where signout involves session deletion from the PostgreSQL `session` table plus cookie clearing plus rate-limit cleanup, and (3) the `AUTH_*` prefix is reserved for authentication flow events (login attempts, lockouts, password changes). The implemented `AuditEventType.SESSION_SIGNOUT` maps to the string `'session.signout'` and is used consistently in `apps/api/src/routes/auth/signout.ts` and `apps/api/src/utils/audit-logger.ts`.

---

## Related Specs

- **SPEC-019 (Security & Permissions Hardening)**: SPEC-026 was created to close testing gaps identified during the SPEC-019 post-mortem audit. While SPEC-019 hardened application code (middleware auth, IDOR prevention, permission model, rate limiting, CORS, Docker, etc.), SPEC-026 adds automated test coverage for those mechanisms and implements additional protective measures (brute-force lockout, structured audit logging, webhook signature tests, session invalidation tests).
