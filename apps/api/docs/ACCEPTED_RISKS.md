# Accepted Security Risks

Last updated: 2026-03-01 (SPEC-019)

## 1. Cookie Cache Propagation Delay

**Risk**: Role/permission changes (ban, role change) take up to 5 minutes to propagate due to Better Auth's cookie session cache.

**Mitigation**: The 5-minute window is acceptable for this application because admin role changes are infrequent. The `COOKIE_CACHE_MAX_AGE` constant in `lib/auth.ts` can be reduced or caching disabled entirely if near-instant revocation is needed.

**Severity**: Low

## 2. In-Memory Rate Limiting (RESOLVED)

**Risk**: The rate limiter previously used an in-memory Map store. In multi-instance deployments, each instance had its own rate limit counters, allowing users to exceed limits by hitting different instances.

**Resolution**: Rate limiter now uses Redis when `HOSPEDA_REDIS_URL` is configured (T-024/T-025 completed). The implementation gracefully falls back to in-memory when Redis is unavailable. Redis keys use TTL-based expiration matching each endpoint type's window duration.

**Severity**: Resolved

## 3. No Runtime Response Schema Filtering

**Risk**: API route handlers return raw database entities. The `responseSchema` declared on routes is used for OpenAPI docs only, not runtime filtering. If a sensitive field were added to the users table, it could leak in responses.

**Mitigation**: Password hashes are isolated in Better Auth's `account` table (never in the `users` table). Response schemas (UserPublicSchema, UserProtectedSchema) correctly declare minimal fields. The response-validator middleware logs warnings in development when extra fields are present.

**Severity**: Low (current design prevents exposure)

## 4. Credential Rotation Pending

**Risk**: Database credentials, Better Auth secret, and API keys have not been rotated since .env was removed from git history tracking.

**Mitigation**: .env is in .gitignore. Credentials should be rotated as part of deployment hardening (T-007..T-009). Git history purge (T-010) is recommended but not blocking.

**Severity**: Medium (manual task, deferred)

## 5. Exchange Rate Management Routes (RESOLVED)

**Risk**: Exchange rate CRUD operations previously used `createProtectedRoute` rather than `createAdminRoute`.

**Resolution**: Admin exchange rate routes now use `createAdminRoute` with explicit permission flags (T-034 completed). Protected routes remain available at `/api/v1/protected/exchange-rates` for authenticated users with appropriate permissions.

**Severity**: Resolved

## 7. QZPay Library Routes Lack Per-Resource Ownership Verification

**Risk**: Routes provided by `@qazuor/qzpay-hono` (customers, subscriptions, invoices, payments, entitlements, checkout) only verify that the user is authenticated via `billingAuthMiddleware`. They do not verify that the authenticated user owns the specific resource being accessed. An authenticated user could potentially access another user's billing data by changing resource IDs in the URL.

**Affected Routes**: `GET/PUT/DELETE /billing/customers/:id`, `GET /billing/subscriptions/:id`, `GET /billing/invoices/:id`, `POST /billing/payments/:id/refund`, `GET /billing/entitlements/:id`.

**Mitigation**: Custom billing routes (addons, usage, trial status) correctly use `billingCustomerId` from the auth context. For qzpay-hono routes, ownership verification middleware should be added between the auth middleware and the library's handlers. This requires changes to `@qazuor/qzpay-hono` to support a custom ownership middleware hook, or wrapping each route individually.

**Severity**: Medium (requires authenticated user, billing data exposure)

## 8. Sponsorship Service Checks Permissions But Not Ownership

**Risk**: `SponsorshipService._canView`, `_canUpdate`, and `_canSoftDelete` check for `PermissionEnum.SPONSORSHIP_*` permissions but do not verify that the entity belongs to the acting user. A user with `SPONSORSHIP_VIEW` can view any sponsorship, not just their own.

**Mitigation**: Sponsorship permissions are typically only granted to admin-level users who legitimately need cross-tenant access. If sponsorship self-management is added for regular users in the future, ownership checks must be added to the service hooks.

**Severity**: Low (permissions restricted to admin users currently)

## 6. Forced Password Change Not Implemented

**Risk**: The super admin seeded account does not force a password change on first login. If `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` env var is not set, a cryptographically random password is generated and printed to stdout (T-012 completed).

**Mitigation**: Random password generation prevents default credential attacks. The previous hardcoded password `SuperAdmin123!` has been removed. Forced password change (T-013) is planned for a future iteration. Production deployments should set `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` explicitly.

**Severity**: Low (random password mitigates the main risk)

## 9. /auth/me Endpoint Exposes Full Permission Array

**Status**: Accepted (by design)

**Risk**: The `/api/v1/public/auth/me` endpoint returns the full actor object including the complete permissions array for all authenticated users. This reveals the internal permission structure.

**Mitigation**: This is intentional. Permissions are returned to all authenticated users (not just admins) because the admin panel relies on client-side permission checks (e.g., `ACCESS_PANEL_ADMIN`) for routing and UI gating. Unauthenticated requests receive a GUEST actor with no permissions. The permissions describe what the user can do, which the UI already exposes through available actions. Server-side enforcement remains the security boundary.

**Severity**: Low (requires valid session, information is not actionable)

## 11. CORS Uses Explicit Origins Instead of Wildcard Subdomain Matching

**Decision**: The CORS middleware uses an explicit list of allowed origins (`HOSPEDA_SITE_URL`, `HOSPEDA_ADMIN_URL`) rather than wildcard subdomain matching (e.g., `*.hospeda.com`).

**Rationale**: OWASP recommends against wildcard CORS origins when credentials are involved. Explicit origins are more secure because they prevent subdomain takeover attacks from being escalated to CORS bypasses. The `originVerificationMiddleware` already supports wildcard patterns for the separate origin header check, but CORS itself uses the strict list.

**Trade-off**: Adding a new subdomain (e.g., a staging environment) requires updating environment variables. This is acceptable since new subdomains are infrequent and should be explicitly authorized.

**Severity**: N/A (security design decision, not a risk)

## 10. @tanstack/form-core Transitive Vulnerability

**Risk**: `@tanstack/react-form@0.39.2` depends on `@tanstack/form-core@<0.42.1` which has a known prototype pollution vulnerability (GHSA-ggv3-vmgw-xv2q). Forcing the override to >=0.42.1 breaks type compatibility with the current react-form version.

**Mitigation**: This is a client-side admin panel dependency only. The vulnerability requires an attacker to control form field values, which is not exploitable since the admin panel is behind authentication and role guards. Resolution requires upgrading `@tanstack/react-form` from 0.x to 1.x (breaking API change).

**Severity**: Low (admin-only, requires authenticated admin user)
