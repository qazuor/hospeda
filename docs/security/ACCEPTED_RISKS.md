# Accepted Security Risks

This document lists known security risks that have been reviewed and accepted. Each risk has a unique identifier, rationale, and mitigations in place.

## SEC-001: Entitlements Fail-Closed by Design

**Source:** SPEC-037 GAP-08

**Description:** When the billing system is unavailable, entitlement checks fail closed (deny access). This means users may temporarily lose access to paid features during billing service outages.

**Risk Level:** Low

**Rationale:** Fail-closed is the safer default for a billing system. Fail-open would allow unpaid access. The blast radius is limited since billing outages are brief and only affect premium features.

**Mitigations:**

- Grace period middleware allows recovery paths through even when blocked
- Billing middleware logs warnings when service is unavailable
- Health check endpoints monitor billing service availability

---

## SEC-002: Permissions Exposed in /auth/me Response

**Source:** SPEC-037 GAP-44

**Description:** The `/api/v1/public/auth/me` endpoint returns the user's permissions array. This data is needed for client-side UI gating (showing/hiding admin buttons, menu items, etc.).

**Risk Level:** Low

**Rationale:** Permissions are the user's own data and are needed by both the web app and admin panel for UI rendering. Server-side enforcement is the actual security boundary. Knowing your own permissions does not enable privilege escalation. Unauthenticated requests receive a GUEST actor with no permissions. The permissions describe what the user can do, which the UI already exposes through available actions.

**Mitigations:**

- All permission checks are enforced server-side in API routes and services
- Permissions are read-only in the response (cannot be modified via API)
- Session cookies are httpOnly and cannot be tampered with

---

## SEC-003: Vercel Free Plan Cron Limitation

**Source:** SPEC-037 GAP-65

**Description:** Vercel's free (Hobby) plan supports only daily cron schedules, not hourly. The `webhook-retry` job is configured for hourly execution (`0 */1 * * *`) but on Vercel free plan will only run once daily.

**Risk Level:** Low

**Rationale:** Failed webhooks are persisted in the dead letter queue and retried whenever the cron runs. Delayed retry (daily vs hourly) affects time-to-resolution but not data integrity. The dead letter queue preserves all failed events.

**Mitigations:**

- Dead letter queue ensures no webhook events are lost
- Admin panel provides manual webhook retry via `/admin/cron/webhook-retry`
- Upgrading to Vercel Pro enables hourly schedules
- Self-hosted deployments use `node-cron` adapter with real hourly scheduling

---

## SEC-004: No Runtime Response Schema Filtering

**Source:** SPEC-019

**Description:** API route handlers return raw database entities. The `responseSchema` declared on routes is used for OpenAPI docs only, not runtime filtering. If a sensitive field were added to the users table, it could leak in responses.

**Risk Level:** Low

**Rationale:** Current design prevents exposure. Password hashes are isolated in Better Auth's `account` table (never in the `users` table). Response schemas (UserPublicSchema, UserProtectedSchema) correctly declare minimal fields.

**Mitigations:**

- Password hashes isolated in Better Auth's `account` table
- Response schemas declare minimal fields
- Response-validator middleware logs warnings in development when extra fields are present

---

## SEC-005: Credential Rotation Pending

**Source:** SPEC-019

**Description:** Database credentials, Better Auth secret, and API keys have not been rotated since .env was removed from git history tracking.

**Risk Level:** Medium (deferred)

**Rationale:** Manual task deferred to deployment hardening phase. Credentials should be rotated as part of deployment hardening (T-007..T-009). Git history purge (T-010) is recommended but not blocking.

**Mitigations:**

- .env is in .gitignore
- Production deployments should rotate credentials before going live

---

## SEC-006: Forced Password Change Not Implemented

**Source:** SPEC-019

**Description:** The super admin seeded account does not force a password change on first login. If `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` env var is not set, a cryptographically random password is generated and printed to stdout.

**Risk Level:** Low

**Rationale:** Random password generation prevents default credential attacks. The previous hardcoded password `SuperAdmin123!` has been removed. Forced password change is planned for a future iteration.

**Mitigations:**

- Random password generation when env var not set
- Production deployments should set `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` explicitly

---

## SEC-007: QZPay Library Routes Lack Per-Resource Ownership Verification

**Source:** SPEC-019

**Description:** Routes provided by `@qazuor/qzpay-hono` (customers, subscriptions, invoices, payments, entitlements, checkout) only verify that the user is authenticated via `billingAuthMiddleware`. They do not verify that the authenticated user owns the specific resource being accessed. An authenticated user could potentially access another user's billing data by changing resource IDs in the URL.

**Risk Level:** Medium (requires authenticated user, billing data exposure)

**Affected Routes:** `GET/PUT/DELETE /billing/customers/:id`, `GET /billing/subscriptions/:id`, `GET /billing/invoices/:id`, `POST /billing/payments/:id/refund`, `GET /billing/entitlements/:id`.

**Mitigations:**

- Custom billing routes (addons, usage, trial status) correctly use `billingCustomerId` from the auth context
- Ownership verification middleware should be added between the auth middleware and the library's handlers
- Requires changes to `@qazuor/qzpay-hono` to support a custom ownership middleware hook

---

## SEC-008: Sponsorship Service Checks Permissions But Not Ownership

**Source:** SPEC-019

**Description:** `SponsorshipService._canView`, `_canUpdate`, and `_canSoftDelete` check for `PermissionEnum.SPONSORSHIP_*` permissions but do not verify that the entity belongs to the acting user. A user with `SPONSORSHIP_VIEW` can view any sponsorship, not just their own.

**Risk Level:** Low

**Rationale:** Sponsorship permissions are typically only granted to admin-level users who legitimately need cross-tenant access. If sponsorship self-management is added for regular users in the future, ownership checks must be added to the service hooks.

**Mitigations:**

- Sponsorship permissions restricted to admin users currently
- Future self-management feature would require ownership checks

---

## SEC-009: CORS Uses Explicit Origins Instead of Wildcard Subdomain Matching

**Source:** SPEC-019

**Description:** The CORS middleware uses an explicit list of allowed origins (`HOSPEDA_SITE_URL`, `HOSPEDA_ADMIN_URL`) rather than wildcard subdomain matching (e.g., `*.hospeda.com`).

**Risk Level:** N/A (security design decision, not a risk)

**Rationale:** OWASP recommends against wildcard CORS origins when credentials are involved. Explicit origins are more secure because they prevent subdomain takeover attacks from being escalated to CORS bypasses. The `originVerificationMiddleware` already supports wildcard patterns for the separate origin header check, but CORS itself uses the strict list.

**Trade-off:** Adding a new subdomain (e.g., a staging environment) requires updating environment variables. This is acceptable since new subdomains are infrequent and should be explicitly authorized.

---

## SEC-010: @tanstack/form-core Transitive Vulnerability

**Source:** SPEC-019

**Description:** `@tanstack/react-form@0.39.2` depends on `@tanstack/form-core@<0.42.1` which has a known prototype pollution vulnerability (GHSA-ggv3-vmgw-xv2q). Forcing the override to >=0.42.1 breaks type compatibility with the current react-form version.

**Risk Level:** Low

**Rationale:** This is a client-side admin panel dependency only. The vulnerability requires an attacker to control form field values, which is not exploitable since the admin panel is behind authentication and role guards. Resolution requires upgrading `@tanstack/react-form` from 0.x to 1.x (breaking API change).

**Mitigations:**

- Admin-only dependency, requires authenticated admin user
- Upgrade to `@tanstack/react-form` 1.x planned for future iteration

---

## SEC-011: In-Memory Rate Limiting (RESOLVED)

**Source:** SPEC-019

**Status:** Resolved

**Description:** The rate limiter previously used an in-memory Map store. In multi-instance deployments, each instance had its own rate limit counters, allowing users to exceed limits by hitting different instances.

**Resolution:** Rate limiter now uses Redis when `HOSPEDA_REDIS_URL` is configured (T-024/T-025 completed). The implementation gracefully falls back to in-memory when Redis is unavailable. Redis keys use TTL-based expiration matching each endpoint type's window duration.

---

## SEC-012: Exchange Rate Management Routes (RESOLVED)

**Source:** SPEC-019

**Status:** Resolved

**Description:** Exchange rate CRUD operations previously used `createProtectedRoute` rather than `createAdminRoute`.

**Resolution:** Admin exchange rate routes now use `createAdminRoute` with explicit permission flags (T-034 completed). Protected routes remain available at `/api/v1/protected/exchange-rates` for authenticated users with appropriate permissions.

---

## SEC-013: Raw mpPreapprovalId in DB Metadata

**Source:** SPEC-037 GAP-05

**Description:** MercadoPago preapproval IDs are stored in subscription metadata fields in the database. These external identifiers are needed for payment reconciliation between the billing system and MercadoPago.

**Risk Level:** Low (accepted)

**Rationale:** The `mpPreapprovalId` is a low-sensitivity external identifier, not PII. It is an opaque reference ID generated by MercadoPago and does not contain payment details, personal information, or authentication credentials. Storing it is required for matching local subscriptions with MercadoPago records during webhook processing and reconciliation.

**Mitigations:**

- The ID is opaque and not usable without MercadoPago API credentials
- Database access is restricted to authenticated services only
- No PII or financial data is contained in the identifier itself

---

## SEC-014: SUPER_ADMIN Gets All Permissions at Actor Construction

**Source:** SPEC-037 GAP-21

**Description:** When an actor is constructed for a user with the SUPER_ADMIN role, all permissions from `PermissionEnum` are granted at construction time rather than being checked per-request against a database or permissions table.

**Risk Level:** Low (accepted, by design)

**Rationale:** This is a deliberate performance optimization. SUPER_ADMIN is the highest privilege level and by definition has unrestricted access to all system features. Granting all permissions at actor construction avoids redundant per-request permission lookups for a role that would pass every check anyway. The set of SUPER_ADMIN users is tightly controlled (typically only the seeded super admin account).

**Mitigations:**

- SUPER_ADMIN role assignment is restricted and auditable
- Permission checks are still enforced at every route/service boundary
- The optimization only applies to the SUPER_ADMIN role; other roles resolve permissions normally

---

## SEC-015: 5-Minute Session Cache TTL

**Source:** SPEC-037 GAP-26

**Description:** Session data is cached for 5 minutes via Better Auth's cookie session cache (`COOKIE_CACHE_MAX_AGE`). Changes to a user's account (ban, role update, permission changes) take up to 5 minutes to propagate to active sessions.

**Risk Level:** Low (accepted)

**Rationale:** This is a standard performance tradeoff between session freshness and database load. Without caching, every authenticated request would require a database lookup to verify the session and fetch permissions. The 5-minute window is acceptable because admin role changes are infrequent and the TTL is configurable.

**Mitigations:**

- `COOKIE_CACHE_MAX_AGE` constant in `lib/auth.ts` can be reduced or caching disabled entirely
- Critical security actions (e.g., ban) can be supplemented with token revocation if near-instant propagation is needed
- The TTL is configurable via environment variable for different deployment requirements

---

## Review Schedule

This document should be reviewed:

- When new security gaps are identified and accepted
- During quarterly security reviews
- Before major releases or deployment changes

**Last Updated:** 2026-03-09
