---
spec-id: SPEC-019
title: Security & Permissions Hardening
type: security
complexity: high
status: completed
created: 2026-02-27T00:00:00.000Z
approved: 2026-02-27T00:00:00.000Z
completed: 2026-03-02T00:00:00.000Z
related-specs:
  - SPEC-026
---

## SPEC-019: Security & Permissions Hardening

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Resolve all critical, high, and medium security and permission vulnerabilities identified in the pre-production readiness audit before the platform goes live. This spec covers dependency vulnerabilities, secret exposure remediation, authentication bypass risks, IDOR (Insecure Direct Object Reference) vulnerabilities, permission model inconsistencies, and hardening of production infrastructure configuration.

#### Motivation

The audit identified 24 distinct findings across two severity tiers. The most severe issues — a Hono middleware auth bypass via URL path parsing, an IDOR allowing any authenticated user to access other users' billing data, a hardcoded super admin password in seed code, and secrets previously committed to git history — represent critical pre-launch blockers. If left unresolved, these issues would expose the platform to unauthorized data access, account takeover, and credential theft from the moment of public deployment.

Beyond the critical items, a pattern of role-based checks mixed with permission-based checks, unprotected dev endpoints reachable without credentials, and missing production hardening (HTTPS enforcement, non-root Docker user, in-memory rate limiting that does not survive horizontal scaling) collectively represent a fragile security posture that will degrade over time.

#### Success Metrics

- Zero known vulnerable dependency versions in the production dependency graph (npm audit clean)
- All secrets that appeared in git history have been rotated and the commits purged
- No hardcoded credentials exist anywhere in source code or seed files
- Any authenticated user cannot access or modify another user's billing resources (IDOR eliminated)
- All metrics endpoints require admin-level authorization
- Rate limiting state survives across multiple API instances (Redis-backed)
- The API Docker container runs as a non-root user
- Swagger/Scalar documentation is inaccessible in production without authentication
- The wildcard subdomain CORS matching does not match sibling domains
- All permission checks in services use PermissionEnum only (no direct role checks)
- The admin UI route guard verifies admin role in addition to authentication
- The `/auth/me` endpoint does not expose the full actor permission set

#### Target Users

- **Platform operators**: Benefit from a production-safe deployment with no known critical vulnerabilities
- **End users (visitors and hosts)**: Their billing data, credentials, and personal information are protected from IDOR and unauthorized access
- **Administrators**: Their credentials and session integrity are protected

---

### 2. User Stories & Acceptance Criteria

#### US-01: Dependency Vulnerabilities Resolved

**As a** platform operator,
**I want** all production dependencies to be free of known critical and high vulnerabilities,
**so that** the platform is not exposed to publicly documented attack vectors at launch.

**Acceptance Criteria:**

- **Given** the monorepo dependency tree, **When** `npm audit --production` runs, **Then** zero critical or high severity advisories are reported
- **Given** `hono` was on a version affected by CVE URL path parsing confusion (4.8.0-4.9.5), **When** the upgrade is applied, **Then** `hono` version is `>=4.9.6` across all workspace packages that declare it
- **Given** `@tanstack/form-core`, `devalue`, and `path-to-regexp` had known prototype pollution or ReDoS advisories, **When** dependencies are updated, **Then** those packages are at non-vulnerable versions
- **Given** the upgrade is applied, **When** the full test suite runs (`pnpm test`), **Then** all existing tests continue to pass
- **Given** the upgrade is applied, **When** `pnpm typecheck` runs, **Then** zero type errors are introduced by the dependency change

---

#### US-02: Exposed Git History Secrets Remediated

**As a** platform operator,
**I want** all credentials that were ever committed to the git repository to be rotated and purged from history,
**so that** anyone who clones the repository cannot extract working credentials from historical commits.

**Acceptance Criteria:**

- **Given** commits `33bd4124` (`.env` added) and `bacbf585` (`.env` removed) exist in git history, **When** git history is purged using an interactive rewrite tool (e.g., `git filter-repo`), **Then** neither commit contains any credential values and `git log --all -- .env` returns no content with secret values
- **Given** the purge is complete, **When** a fresh `git clone` is performed and `.env` history is inspected, **Then** no credential values are recoverable
- **Given** all credentials that appeared in the `.env` file, **When** each is rotated with the relevant provider (database, Better Auth, external services), **Then** the old credential values are invalidated and new values are stored only in the deployment secrets manager (Fly.io secrets, Vercel environment variables)
- **Given** `.env` is absent from the repository, **When** `.gitignore` is inspected, **Then** `.env` and `.env.local` are listed as ignored patterns
- **Given** no `.env.example` exists (SEC-14), **When** the remediation is complete, **Then** a `.env.example` file exists at the repository root documenting all required environment variables with placeholder values and descriptions, without containing any real credentials

---

#### US-03: Super Admin Credentials Not Hardcoded

**As a** platform operator,
**I want** the super admin account to be created with a secure, randomly generated password rather than a hardcoded value,
**so that** a fresh deployment does not have a predictable admin credential an attacker can exploit.

**Acceptance Criteria:**

- **Given** `packages/seed/src/utils/superAdminLoader.ts` previously contained the literal string `SuperAdmin123!`, **When** the remediation is applied, **Then** no hardcoded password string exists in that file or any other seed file
- **Given** the `HOSPEDA_SUPER_ADMIN_PASSWORD` environment variable is set, **When** the seed runs, **Then** the super admin account is created using that variable's value as the password
- **Given** the `HOSPEDA_SUPER_ADMIN_PASSWORD` environment variable is NOT set, **When** the seed runs, **Then** a cryptographically random password is generated, the super admin account is created with it, and the generated password is printed once to stdout so the operator can record it
- **Given** the super admin account is created for the first time (first login), **When** the super admin logs in, **Then** the system prompts them to change their password before accessing any admin functionality
- **Given** `.env.example`, **When** inspected, **Then** `HOSPEDA_SUPER_ADMIN_PASSWORD` is listed as an optional variable with a description explaining the random-generation fallback

---

#### US-04: Billing Routes Protect Against IDOR

**As a** registered user,
**I want** to be certain that I cannot access or modify another user's billing data,
**so that** my subscription, invoices, and payment information are visible only to me and to authorized administrators.

**Acceptance Criteria:**

- **Given** User A is authenticated and knows User B's customer ID, **When** User A sends `GET /api/v1/protected/billing/customers/:id` with User B's customer ID, **Then** the response is `403 Forbidden` (or `404 Not Found` to avoid enumeration)
- **Given** User A is authenticated, **When** User A sends `PUT /api/v1/protected/billing/subscriptions/:id` targeting a subscription that belongs to User B, **Then** the response is `403 Forbidden`
- **Given** User A is authenticated, **When** User A sends `POST /api/v1/protected/billing/refunds` referencing an invoice that belongs to User B, **Then** the response is `403 Forbidden`
- **Given** an admin user is authenticated with the appropriate `BILLING_MANAGE` permission, **When** the admin accesses any billing resource via `/api/v1/admin/billing/`, **Then** the request is allowed regardless of resource ownership
- **Given** an unauthenticated request reaches any billing route, **When** the middleware chain runs, **Then** the response is `401 Unauthorized`
- **Given** a user's own billing customer, subscription, invoice, and payment records, **When** that user sends valid read or update requests for their own resources, **Then** the requests succeed and return the expected data

---

#### US-05: Metrics Endpoints Require Admin Authorization

**As a** platform operator,
**I want** system metrics endpoints to be accessible only to users with admin-level permissions,
**so that** internal platform telemetry is not visible to regular authenticated users.

**Acceptance Criteria:**

- **Given** a regular (non-admin) authenticated user, **When** they send `GET /api/v1/admin/metrics`, **Then** the response is `403 Forbidden`
- **Given** a regular authenticated user, **When** they send `POST /api/v1/admin/metrics/reset`, **Then** the response is `403 Forbidden`
- **Given** an unauthenticated request, **When** it reaches any metrics endpoint, **Then** the response is `401 Unauthorized`
- **Given** an admin user with the `METRICS_VIEW` permission, **When** they send `GET /api/v1/admin/metrics`, **Then** the response is `200 OK` with metrics data
- **Given** an admin user with the `METRICS_RESET` permission, **When** they send `POST /api/v1/admin/metrics/reset`, **Then** the reset executes and returns `200 OK`

---

#### US-06: Rate Limiting Scales Across API Instances

**As a** platform operator,
**I want** rate limiting to be enforced consistently across all running API instances,
**so that** an attacker cannot bypass rate limits by routing requests through different instances.

**Acceptance Criteria:**

- **Given** two API instances running in parallel, **When** a client sends requests alternating between the two instances and exceeds the rate limit threshold in aggregate, **Then** both instances return `429 Too Many Requests` once the threshold is reached
- **Given** the Redis connection (`HOSPEDA_REDIS_URL`) is available, **When** the API starts, **Then** rate limit counters are stored in Redis, not in process memory
- **Given** the in-memory `Map` store used previously, **When** the code is inspected, **Then** it no longer exists as the primary rate limit store
- **Given** a period of low traffic, **When** rate limit entries expire (TTL-based), **Then** Redis automatically removes expired entries without manual cleanup code
- **Given** `.env.example`, **When** inspected, **Then** `HOSPEDA_REDIS_URL` is listed as a required variable for production deployments

---

#### US-07: API Container Runs as Non-Root User

**As a** platform operator,
**I want** the API Docker container to run as a non-root operating system user,
**so that** a container escape or process compromise does not yield root privileges on the host.

**Acceptance Criteria:**

- **Given** `Dockerfile.api`, **When** the image is built and `docker inspect` is run, **Then** the default user is not `root` (UID 0)
- **Given** the container is running, **When** `whoami` is executed inside the container, **Then** the output is a non-root user name (e.g., `hospeda` or `node`)
- **Given** the non-root user setup, **When** the application starts, **Then** it can write to its designated log and temp directories without permission errors
- **Given** the Dockerfile, **When** reviewed, **Then** `adduser` (or `useradd`) and a `USER` directive are present before the `CMD` instruction

---

#### US-08: API Documentation Hidden in Production

**As a** platform operator,
**I want** Swagger and Scalar API documentation endpoints to be unavailable or protected in production,
**so that** internal API structure is not publicly discoverable by potential attackers.

**Acceptance Criteria:**

- **Given** the application runs with `NODE_ENV=production`, **When** a request is sent to `/docs`, `/reference`, or `/ui`, **Then** the response is `404 Not Found` or `401 Unauthorized`
- **Given** the application runs with `NODE_ENV=development`, **When** a request is sent to `/docs`, **Then** the documentation is accessible as normal
- **Given** a production deployment where documentation access is required for internal tooling, **When** the docs route is configured with an API key guard, **Then** requests with a valid `Authorization` header can access the documentation
- **Given** the application environment is not explicitly `development`, **When** the route registration runs, **Then** documentation routes are either not registered or registered behind authentication middleware

---

#### US-09: CORS Wildcard Subdomain Matching Is Correct

**As a** platform operator,
**I want** the CORS origin validation to reject sibling domains that happen to end with the allowed domain suffix,
**so that** `evil-example.com` is not granted CORS access because it ends with `example.com`.

**Acceptance Criteria:**

- **Given** the allowed origin pattern is `*.hospeda.com.ar`, **When** a request arrives from `evil-hospeda.com.ar`, **Then** the origin is rejected and the CORS headers are not set
- **Given** the allowed origin pattern is `*.hospeda.com.ar`, **When** a request arrives from `admin.hospeda.com.ar`, **Then** the origin is allowed and CORS headers are set correctly
- **Given** the allowed origin pattern is `*.hospeda.com.ar`, **When** a request arrives from `hospeda.com.ar` (apex domain, no subdomain), **Then** the behavior matches the configured apex domain allowlist (allowed if explicitly listed, rejected otherwise)
- **Given** the security middleware in `apps/api/src/middlewares/security.ts`, **When** a wildcard pattern is evaluated, **Then** the check verifies the origin ends with `.` followed by the base domain, not just the bare base domain string

---

#### US-10: Cron Endpoints Always Require Authentication

**As a** platform operator,
**I want** cron endpoints to be inaccessible without a secret key in all environments,
**so that** unauthorized parties cannot trigger scheduled jobs even in development or test environments.

**Acceptance Criteria:**

- **Given** `CRON_SECRET` is not set and the environment is not production, **When** a request arrives at any cron endpoint, **Then** the response is `401 Unauthorized` (requests are blocked by default, not allowed)
- **Given** `CRON_AUTH_DISABLED=true` is set, **When** the application attempts to start or register cron routes, **Then** the application logs a warning and refuses to start if `NODE_ENV=production`, OR the setting is ignored entirely and authentication is always enforced
- **Given** `CRON_SECRET` is set to a non-empty string, **When** a request arrives with `Authorization: Bearer <CRON_SECRET>`, **Then** the request is processed normally
- **Given** `CRON_SECRET` is set, **When** a request arrives without the `Authorization` header or with an incorrect secret, **Then** the response is `401 Unauthorized`
- **Given** the environment schema (`env.ts` or equivalent), **When** inspected, **Then** `CRON_SECRET` is listed as a required variable in production

---

#### US-11: Exchange Rate Routes Are Under the Correct Authorization Tier

**As a** platform operator,
**I want** exchange rate routes to be mounted under the correct authorization tier,
**so that** public and protected routes are not accidentally accessible via the admin path without admin authentication.

**Acceptance Criteria:**

- **Given** the current routing table in `apps/api/src/routes/index.ts`, **When** the remediation is applied, **Then** public exchange rate routes are mounted under `/api/v1/public/` and protected routes under `/api/v1/protected/`, not under `/api/v1/admin/`
- **Given** a non-admin authenticated user, **When** they access exchange rate data via the correct public or protected endpoint, **Then** the response is `200 OK`
- **Given** an admin-only exchange rate management route (e.g., create, update, delete), **When** a non-admin user attempts to access it, **Then** the response is `403 Forbidden`

---

#### US-12: HTML Output Is Sanitized Against XSS

**As a** visitor browsing the web app,
**I want** content rendered from the API to be sanitized before it is injected into the HTML page,
**so that** malicious HTML or JavaScript stored in the database cannot execute in my browser.

**Acceptance Criteria:**

- **Given** an Astro page that uses `set:html` to render API-sourced content, **When** the content contains a `<script>` tag, **Then** the `<script>` tag is stripped before the HTML is rendered in the browser
- **Given** an Astro page using `set:html`, **When** the content contains an `onerror` or `onclick` inline event attribute, **Then** those attributes are stripped from the rendered output
- **Given** safe, legitimate HTML content (e.g., `<strong>`, `<em>`, `<p>`, `<a>`), **When** passed through the sanitizer, **Then** it is preserved and rendered correctly
- **Given** all Astro files using `set:html` with dynamic API content, **When** code review is performed, **Then** each usage passes the content through a shared sanitization utility before assignment

---

#### US-13: Request Body Size Is Enforced Against Chunked Bypass

**As a** platform operator,
**I want** the body size limit to be enforced at the HTTP layer regardless of how the request is encoded,
**so that** an attacker cannot bypass size limits by using chunked transfer encoding.

**Acceptance Criteria:**

- **Given** a request with a `Content-Length` header below the limit but an actual body exceeding the limit sent via chunked transfer encoding, **When** the request is processed, **Then** the server rejects it with `413 Payload Too Large`
- **Given** Hono's `bodyLimit` middleware is applied, **When** any request body exceeds the configured maximum size, **Then** the middleware rejects the request before the route handler runs
- **Given** a valid request within the size limit, **When** it is processed normally, **Then** it is not rejected

---

#### US-14: Permission Checks Use PermissionEnum Consistently

**As a** platform developer,
**I want** all service-layer authorization checks to use `PermissionEnum` values rather than checking actor roles directly,
**so that** permission logic is centralized, auditable, and consistent with the project's established permission model.

**Acceptance Criteria:**

- **Given** `service-core/src/utils/permission.ts`, **When** the code is reviewed after remediation, **Then** no usage of `actor.role === RoleEnum.ADMIN` (or any role comparison) appears in that file
- **Given** `accommodation.service.ts` and `post.service.ts`, **When** reviewed, **Then** all authorization decisions are made by checking whether the actor has a specific `PermissionEnum` value, not by comparing `actor.role`
- **Given** `post.permissions.ts`, **When** reviewed, **Then** role-based checks are replaced with permission-based equivalents
- **Given** the refactored permission checks, **When** an actor with admin role but without a specific permission is tested, **Then** the permission check returns the same result as for any other actor missing that permission (roles alone do not grant access)
- **Given** all existing permission-related unit tests, **When** the test suite runs, **Then** all tests pass with the refactored implementation

---

#### US-15: Admin UI Verifies Admin Role at Route Guard Level

**As a** platform operator,
**I want** the admin application's route guard to verify that the authenticated user holds an admin role,
**so that** a regular authenticated user who discovers the admin URL cannot access administrative functionality.

**Acceptance Criteria:**

- **Given** a user who is authenticated but has a `USER` role (not `ADMIN`), **When** they navigate to any route under `apps/admin`, **Then** they are redirected to an unauthorized page or back to the web app login
- **Given** a user who is authenticated with an `ADMIN` role, **When** they navigate to any admin route, **Then** they can access the route normally
- **Given** an unauthenticated user, **When** they navigate to any admin route, **Then** the existing authentication redirect behavior is preserved (redirected to login)
- **Given** the route guard in `apps/admin/src/routes/_authed.tsx`, **When** reviewed, **Then** it checks both `session.user` existence AND `session.user.role === RoleEnum.ADMIN` (or equivalent permission check)

---

#### US-16: The /auth/me Endpoint Returns a Filtered User Profile

**As a** registered user,
**I want** the `/auth/me` endpoint to return only the information my session requires,
**so that** the full list of internal permission flags and sensitive actor metadata is not unnecessarily transmitted to clients.

**Acceptance Criteria:**

- **Given** an authenticated user calls `GET /api/v1/public/auth/me` (or the protected equivalent), **When** the response is returned, **Then** it includes: `id`, `email`, `name`, `role`, and the permissions directly relevant to the client application
- **Given** the full actor object includes fields like raw permission arrays with internal codes, sensitive metadata, or audit fields, **When** the response is serialized, **Then** those fields are absent from the response body
- **Given** the admin panel calls `/auth/me` to bootstrap the session, **When** the response is returned, **Then** it includes enough information to render the UI (role, display name, avatar) without exposing an exhaustive permission dump
- **Given** the route handler in `apps/api/src/routes/auth/me.ts`, **When** reviewed after remediation, **Then** a response schema or explicit field selection filters the actor object before serialization

---

#### US-17: SQL Injection Risk in Billing Metrics Eliminated

**As a** platform operator,
**I want** all database queries to use parameterized values rather than string interpolation,
**so that** no user-controlled or partially-controlled input can alter the structure of a SQL query.

**Acceptance Criteria:**

- **Given** `apps/api/src/services/billing-metrics.service.ts` previously used `sql.raw(months.toString())` to interpolate the `months` value into an `INTERVAL` expression, **When** the fix is applied, **Then** that code is replaced with a Drizzle-native parameterized interval expression or a validated integer passed through a safe binding
- **Given** the `months` parameter is validated to be a positive integer before use, **When** an out-of-range or non-integer value is passed, **Then** the service returns a validation error rather than executing a query
- **Given** the fixed implementation, **When** a months value of `1; DROP TABLE billing_subscriptions` is passed to the service, **Then** the query fails validation and never reaches the database

---

#### US-18: Error Responses Do Not Leak Internal Details in Production

**As a** platform operator,
**I want** internal error details to be suppressed in production API error responses,
**so that** stack traces, query details, and internal service messages are not exposed to potential attackers.

**Acceptance Criteria:**

- **Given** an unhandled exception triggers a 500 response in production (`NODE_ENV=production`), **When** the error response is returned, **Then** the `details` field is absent or contains only a generic message
- **Given** the same unhandled exception in development, **When** the error response is returned, **Then** the `details` field is present with full diagnostic information for debugging
- **Given** a 400 validation error in production, **When** the error response is returned, **Then** the `details` field may still include field-level validation messages (these are safe to expose)
- **Given** the error handler in `apps/api/src/middlewares/response.ts`, **When** reviewed, **Then** it branches on `NODE_ENV` (or an equivalent `IS_PRODUCTION` flag) before including the `details` field on 5xx responses

---

#### US-19: HTTPS Enforced on Fly.io

**As a** platform operator,
**I want** all HTTP traffic to the API to be automatically redirected to HTTPS,
**so that** no credentials, tokens, or user data are transmitted over unencrypted connections.

**Acceptance Criteria:**

- **Given** `apps/api/fly.toml`, **When** reviewed, **Then** `force_https = true` is present under the `[[services]]` or `[http_service]` section
- **Given** a request sent to `http://api.hospeda.com.ar/...`, **When** Fly.io receives it, **Then** it is redirected to `https://api.hospeda.com.ar/...` with a `301` or `308` redirect
- **Given** a request sent directly to `https://api.hospeda.com.ar/...`, **When** processed, **Then** no redirect occurs and the request is handled normally

---

#### US-20: Unused CORS Headers Removed

**As a** platform operator,
**I want** the CORS configuration to not advertise custom headers (`x-actor-id`, `x-user-id`) that are not used by any client,
**so that** the attack surface is minimized and the CORS configuration accurately reflects actual usage.

**Acceptance Criteria:**

- **Given** `apps/api/src/utils/env.ts` previously listed `x-actor-id` and `x-user-id` in the `allowedHeaders` CORS configuration, **When** the remediation is applied and those headers are confirmed unused by `apps/web` and `apps/admin`, **Then** those headers are removed from the CORS allowed headers list
- **Given** the remaining allowed CORS headers, **When** the client applications make requests, **Then** no `403 Forbidden` errors occur due to header rejection

---

### 3. UX Considerations

#### User-Facing Impact

The majority of changes in this spec are invisible to end users during normal operation. The following user-facing behaviors change:

- **Super admin first login**: After seeding, the super admin is prompted to set a new password on first login. This is a one-time friction point that improves long-term security.
- **Error messages**: In production, 500 errors return a generic message without internal details. Users who previously saw diagnostic information in error toasts will see a generic "An unexpected error occurred" message instead.
- **Unauthorized access to another user's billing**: Regular users who, intentionally or accidentally, attempt to access a billing resource belonging to another user will receive a `403` or `404` instead of the data. This is the correct behavior and should be transparent to legitimate users.
- **Admin route guard for regular users**: A regular authenticated user who navigates to the admin URL will be redirected rather than seeing a potentially broken admin UI. This is an improvement over the previous silent failure.

#### Error States

- **IDOR attempt on billing**: The user receives an HTTP `403 Forbidden` or `404 Not Found`. The web app should display a generic "Access denied" or "Resource not found" page, not expose that a resource exists for another user.
- **Cron endpoint without secret**: Returns `401 Unauthorized`. No user-facing impact since cron is a server-to-server call.
- **Docs endpoint in production**: Returns `404`. No user-facing impact since docs are for developer use.
- **Body too large**: Returns `413 Payload Too Large`. The web app should display a user-friendly "Upload too large" message.

#### Accessibility

- The forced-password-change flow for the super admin must be keyboard navigable and screen reader compatible. It follows the same form patterns as the rest of the admin UI.
- The unauthorized redirect for non-admin users in the admin app must render a page with appropriate heading structure and not just a blank screen.

---

### 4. Out of Scope

The following items are explicitly deferred or excluded from this spec:

- **Penetration testing**: This spec addresses known audit findings. A formal penetration test by an external party is a separate engagement.
- **WAF (Web Application Firewall)**: Adding a WAF in front of the Fly.io deployment is out of scope. Fly.io platform-level protections are assumed to be in place.
- **Multi-factor authentication (MFA)**: Not part of this hardening iteration. Deferred to a future authentication enhancement spec.
- **Secret scanning CI integration**: Setting up automated secret detection (e.g., `git-secrets`, `truffleHog`) in the CI pipeline is a separate DevOps task not covered here.
- **Full security audit of the billing package from `qzpay-hono`**: The third-party billing integration is treated as a black box. Only the routes and services within the `hospeda` monorepo are in scope.
- **Session fixation and CSRF**: Better Auth is assumed to handle CSRF token management. This spec does not extend or modify the Better Auth library.
- **Password policy enforcement beyond the super admin case**: General user password policy (complexity, expiry) is out of scope for this iteration.
- **PERM-07 (password field in accounts schema)**: This is a LOW severity finding. Verification that no endpoint exposes the `accounts` data directly is included as a read-only audit task in Phase 4, but no schema change is required unless the audit finds an actual exposure.
- **SEC-17 (cookie cache desync)**: The 5-minute Better Auth cookie cache is documented as a known tradeoff. Adjusting it is deferred pending a decision on acceptable permission propagation latency. The behavior is documented in this spec as a known limitation.

---

### 5. Risk Assessment

| Risk | Probability | Impact | Notes |
|------|-------------|--------|-------|
| Hono upgrade introduces breaking API changes | Medium | High | Hono minor versions can include behavior changes. All route and middleware tests must pass post-upgrade before merging |
| Git history rewrite disrupts team branches | High | Medium | All contributors must re-clone or reset their local branches after the history rewrite. Coordinate timing with the team |
| Credential rotation causes downtime | Medium | High | Database and auth secret rotation must be done atomically with deployment. Plan a maintenance window |
| Redis dependency for rate limiting adds operational complexity | Low | Medium | Redis is already present (`HOSPEDA_REDIS_URL` exists). No new infrastructure required |
| Permission refactor (PERM-03/04) breaks existing authorization behavior | Medium | High | Requires comprehensive regression testing of all protected routes. Unit tests must cover all affected service methods |
| First-login password change breaks seeding automation in test environments | Low | Low | The forced password change should be skippable in test/CI environments via a flag |
| XSS sanitization library strips legitimate rich content | Low | Medium | Review allowed tags carefully. Use a well-maintained library (e.g., `DOMPurify` server-side via `isomorphic-dompurify` or `sanitize-html`) |

---

### 6. Known Limitations (Accepted Risk)

- **SEC-17: Better Auth cookie cache**: The 5-minute session cache means permission changes (e.g., an admin revoking a user's role) take up to 5 minutes to propagate. This is an accepted tradeoff between performance and immediate revocation. The behavior is documented in the codebase. Consider reducing to 1-2 minutes in a future iteration if near-realtime revocation becomes a requirement.
- **SEC-15: CORS unused headers**: If `x-actor-id` or `x-user-id` are found to be in active use by any client during the audit phase, their removal is deferred and the finding is marked as accepted risk with documentation.

---

## Part 2 - Technical Analysis

### 1. Architecture Overview

This spec does not introduce new features or data models. All changes are hardening, fixes, and refactors across existing code. The affected layers are:

| Layer | Artifact | Change Type |
|-------|----------|-------------|
| Root | All `package.json` files | Dependency version updates |
| Root | `.gitignore`, `.env.example` | Add `.env` ignore, create example file |
| `packages/seed` | `superAdminLoader.ts` | Remove hardcoded password, add random generation |
| `packages/db` | `account.dbschema.ts` | Audit only (LOW) |
| `packages/service-core` | `permission.ts`, `accommodation.service.ts`, `post.service.ts`, `post.permissions.ts` | Replace role checks with permission checks |
| `apps/api` | `routes/billing/index.ts` | Add ownership verification middleware |
| `apps/api` | `routes/metrics/index.ts` | Wrap with `createAdminRoute` |
| `apps/api` | `routes/index.ts` | Re-mount exchange rate routes under correct tier |
| `apps/api` | `routes/auth/me.ts` | Filter actor response fields |
| `apps/api` | `middlewares/rate-limit.ts` | Replace in-memory `Map` with Redis |
| `apps/api` | `middlewares/security.ts` | Fix wildcard subdomain match |
| `apps/api` | `middlewares/response.ts` | Filter `details` on 5xx in production |
| `apps/api` | `middlewares/validation.ts` | Replace `Content-Length` check with `bodyLimit` middleware |
| `apps/api` | `services/billing-metrics.service.ts` | Replace `sql.raw()` with parameterized query |
| `apps/api` | `lib/auth.ts` | Document cookie cache tradeoff (comment) |
| `apps/api` | `utils/env.ts` | Remove unused CORS headers |
| `apps/api` | Docs route registration | Guard behind `NODE_ENV !== 'production'` |
| `apps/api` | `fly.toml` | Add `force_https = true` |
| `apps/api` | `Dockerfile.api` | Add non-root user |
| `apps/api` | `cron/middleware.ts` | Block by default, require `CRON_SECRET` always |
| `apps/admin` | `routes/_authed.tsx` | Add admin role check |
| `apps/web` | All Astro pages using `set:html` | Wrap with sanitization utility |

---

### 2. Implementation Phases

#### Phase 1: Dependency Updates (SEC-01)

1. Audit all `package.json` files across the monorepo for `hono`, `@tanstack/form-core`, `devalue`, and `path-to-regexp`
2. Update `hono` to `>=4.9.6` in all workspace packages where it is declared
3. Update remaining vulnerable dependencies to non-affected versions
4. Run `pnpm install` and resolve any peer dependency conflicts
5. Run full test suite and typecheck. Fix any regressions
6. Verify with `npm audit --production`

#### Phase 2: Secret Remediation (SEC-02, SEC-14, SEC-03)

7. Rotate ALL credentials that appeared in the committed `.env` file: database URL, Better Auth secret, any API keys, any service credentials
8. Update Fly.io secrets and Vercel environment variables with new credential values
9. Purge git history using `git filter-repo --path .env --invert-paths` (coordinate with all contributors to re-clone)
10. Verify the purge: `git log --all -- .env` should show no content with credential values
11. Create `.env.example` at repository root with all required variables, placeholder values, and descriptions for each
12. Remove the hardcoded password from `packages/seed/src/utils/superAdminLoader.ts`
13. Implement random password generation fallback and stdout print behavior
14. Implement forced password change on first login for the super admin account
15. Add `HOSPEDA_SUPER_ADMIN_PASSWORD` to `.env.example`

#### Phase 3: Critical Permission Fixes (PERM-01, PERM-02)

16. Audit `apps/api/src/routes/billing/index.ts` to identify all routes lacking ownership checks
17. Implement an ownership verification middleware or guard that confirms the requesting user owns the target billing resource, or passes if the actor has `BILLING_ADMIN` permission
18. Apply the ownership guard to all billing CRUD routes in the protected tier
19. Migrate any billing operations that should be admin-only to the `/admin/billing/` path with `createAdminRoute`
20. Audit `apps/api/src/routes/metrics/index.ts` and wrap all routes with `createAdminRoute` using appropriate permission flags
21. Write integration tests covering all IDOR scenarios (user A accessing user B's resources) and admin bypass
22. Write integration tests for metrics 403 for non-admin users and 200 for admin users

#### Phase 4: High Severity Fixes (SEC-04 through SEC-09)

23. Replace `sql.raw(months.toString())` in `billing-metrics.service.ts` with a parameterized Drizzle interval expression; add input validation for the `months` parameter
24. Replace in-memory `Map` rate limiter in `middlewares/rate-limit.ts` with a Redis-backed implementation using `HOSPEDA_REDIS_URL`; remove the unbounded `Map`; rely on Redis TTL for cleanup
25. Add `adduser` and `USER` directives to `Dockerfile.api` before the `CMD` instruction
26. Gate docs route registration behind `process.env.NODE_ENV !== 'production'` in the Hono app setup; optionally add API key auth for production access
27. Fix the wildcard subdomain matching in `middlewares/security.ts` to check for a leading `.` before the base domain
28. Add `details` filtering in `middlewares/response.ts` for 5xx errors when `NODE_ENV === 'production'`
29. Replace the `Content-Length`-based body size check in `middlewares/validation.ts` with Hono's `bodyLimit` middleware

#### Phase 5: Medium Severity Fixes (SEC-10 through SEC-16, PERM-03 through PERM-06)

30. Update `cron/middleware.ts` to block all requests when `CRON_SECRET` is not set, regardless of environment; remove `CRON_AUTH_DISABLED` bypass or restrict it to non-production only with a startup warning
31. Add `CRON_SECRET` to the environment variable schema as required for production
32. Audit `apps/api/src/routes/index.ts` and re-mount exchange rate routes under the correct tiers (`/public/` and `/protected/`); ensure any admin-only exchange rate operations use `createAdminRoute`
33. Identify all Astro pages using `set:html` with API-sourced content; create a shared `sanitizeHtml` utility wrapping a server-safe sanitization library; apply it to each identified usage
34. Add `force_https = true` to `fly.toml` under the relevant service section
35. Audit `apps/api/src/utils/env.ts` CORS headers; confirm `x-actor-id` and `x-user-id` are unused by clients; remove them from `allowedHeaders`
36. Refactor `service-core/src/utils/permission.ts`: replace all `actor.role === RoleEnum.ADMIN` checks with `PermissionEnum`-based checks
37. Refactor `accommodation.service.ts`, `post.service.ts`, and `post.permissions.ts` to use permission-based authorization
38. Update all unit tests affected by the permission refactor to test permission presence rather than role identity
39. Add admin role check to `apps/admin/src/routes/_authed.tsx` `beforeLoad` guard
40. Add response field filtering to `apps/api/src/routes/auth/me.ts` using an explicit response schema

#### Phase 6: Low Severity and Audit Tasks

41. Audit `packages/db/src/schemas/user/account.dbschema.ts` and all endpoints that return user or account data; confirm no endpoint exposes the `password` field; document findings
42. Add an inline code comment to `apps/api/src/lib/auth.ts` near the cookie cache configuration documenting the 5-minute propagation tradeoff and the recommendation to reduce it to 1-2 minutes in a future iteration
43. Document accepted risks (SEC-17, SEC-15 if headers are in use) in the project's security notes

#### Phase 7: Verification and Hardening Confirmation

44. Run `npm audit --production` and confirm zero critical/high advisories
45. Run full test suite (`pnpm test`) and confirm all tests pass with minimum 90% coverage
46. Run `pnpm typecheck` and confirm zero type errors
47. Run `pnpm lint` and confirm zero lint errors
48. Deploy to a staging environment and perform manual verification of all user stories using the acceptance criteria as a checklist
49. Verify git history is clean of credential values using `git log --all -S "the-old-secret-value"`
50. Verify the Docker container runs as a non-root user in the staging environment

---

### 3. Dependencies

**External dependencies (new or updated):**

- `hono` upgraded to `>=4.9.6` (already in use)
- A server-safe HTML sanitization library (e.g., `sanitize-html` or `isomorphic-dompurify`) added to `apps/web`
- A Redis client for rate limiting (e.g., `ioredis` or the existing Redis client already used in the project) — confirm if one already exists before adding

**Internal dependencies between tasks:**

- Phase 2 (credential rotation) must complete before Phase 1 changes are deployed to production, since the old credentials will be invalidated
- Phase 3 (billing IDOR fix) depends on understanding which billing routes are protected vs. admin. This requires Phase 5's exchange rate re-mounting audit pattern as a reference
- The permission refactor (Phase 5, tasks 36-38) must be completed before the admin route guard change (task 39) to ensure the guard uses the consistent permission model
- Git history purge (Phase 2) must be coordinated with all active contributors before any subsequent commits are merged

---

### 4. Testing Strategy

#### Unit Tests

- `permission.ts` refactored methods: test that actors with the required `PermissionEnum` value pass, and actors without it fail, regardless of role
- `billing-metrics.service.ts`: test that non-integer or negative `months` values are rejected before hitting the database
- CORS wildcard matching: test `evil-example.com` is rejected, `sub.example.com` is accepted
- Rate limit middleware: test that Redis is called with the correct key and TTL

#### Integration Tests

- Billing IDOR: `GET /protected/billing/customers/:otherId` returns `403` for non-owner
- Billing IDOR: `GET /protected/billing/customers/:ownId` returns `200` for owner
- Billing IDOR: admin with `BILLING_MANAGE` permission can access any customer
- Metrics: `GET /admin/metrics` returns `403` for regular user, `200` for admin
- Metrics: `POST /admin/metrics/reset` returns `403` for regular user, `200` for admin
- Cron: request without `CRON_SECRET` returns `401` in all environments
- Docs: `GET /docs` returns `404` when `NODE_ENV=production`
- Auth me: response does not include raw permission arrays

#### Manual Verification Checklist

- [ ] `npm audit --production` shows zero critical/high advisories
- [ ] `git log --all -- .env` shows no credential values
- [ ] Super admin seed generates a random password and prints it to stdout when env var is absent
- [ ] Super admin is prompted to change password on first login
- [ ] Authenticated non-owner user receives `403` accessing another user's billing data
- [ ] Non-admin user receives `403` on all metrics endpoints
- [ ] API docs (`/docs`, `/reference`, `/ui`) return `404` in production environment
- [ ] HTTP request to API is redirected to HTTPS (verified on staging Fly.io deployment)
- [ ] Docker container runs as non-root user (verified with `docker exec whoami`)
- [ ] Non-admin authenticated user is redirected when accessing any admin app route
- [ ] `/auth/me` response does not include the full permission array
- [ ] Chunked request exceeding body limit returns `413`

---

## Related Specs

- **SPEC-026 (Security Testing Gaps)**: Created as a follow-up to SPEC-019's post-mortem audit. SPEC-026 adds automated test coverage for the security mechanisms implemented in SPEC-019 (webhook signature verification, session invalidation, authorization denials) and implements additional protective measures not covered by SPEC-019 (brute-force account lockout, structured audit logging for security-sensitive operations).
