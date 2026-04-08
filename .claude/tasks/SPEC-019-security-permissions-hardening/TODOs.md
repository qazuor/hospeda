# TODOs: Security & Permissions Hardening

Spec: SPEC-019 | Status: completed | Progress: 47/53 (6 deferred to SPEC-024/SPEC-025)

## Setup - Dependency Updates & Secret Remediation (11 tasks)

- [x] T-001: Update hono to >=4.9.6 across all workspace packages (complexity: 2)
- [x] T-002: Update @tanstack/form-core to non-vulnerable version (complexity: 2)
- [x] T-003: Update devalue to non-vulnerable version (complexity: 2)
- [x] T-004: Update path-to-regexp to non-vulnerable version (complexity: 2)
- [x] T-005: Run pnpm audit and fix remaining high/critical advisories (complexity: 3)
- [x] T-006: Create .env.example with all required variables documented (complexity: 3)
- [~] T-007: Rotate database credentials and update deployment secrets (complexity: 2) **DEFERRED to SPEC-024**
- [~] T-008: Rotate Better Auth secret and update deployment secrets (complexity: 2) **DEFERRED to SPEC-024**
- [~] T-009: Rotate all other API keys and service credentials (complexity: 3) **DEFERRED to SPEC-024**
- [~] T-010: Purge .env from git history using git-filter-repo (complexity: 3) **DEFERRED to SPEC-024**
- [~] T-011: Verify git history purge is clean (complexity: 2) **DEFERRED to SPEC-024**

## Core - Critical Fixes & High Severity (18 tasks)

- [x] T-012: Remove hardcoded password from superAdminLoader.ts and add random generation (complexity: 3)
- [x] T-013: Implement forced password change on first super admin login (complexity: 4)
- [x] T-014: Audit billing routes to identify all routes lacking ownership checks (complexity: 3)
- [x] T-015: Create billing ownership verification middleware (complexity: 4)
- [x] T-016: Apply ownership middleware to billing customer routes (complexity: 3)
- [x] T-017: Apply ownership middleware to billing subscription routes (complexity: 3)
- [x] T-018: Apply ownership middleware to billing invoice and payment routes (complexity: 3)
- [x] T-019: Migrate admin-only billing operations to /admin/billing/ with createAdminRoute (complexity: 3)
- [x] T-020: Wrap metrics routes with createAdminRoute and permission flags (complexity: 3)
- [x] T-022: Replace sql.raw() in billing-metrics.service.ts with parameterized query (complexity: 2)
- [x] T-023: Add input validation for months parameter in billing-metrics (complexity: 2)
- [x] T-024: Create Redis rate limit store implementation (complexity: 4)
- [x] T-025: Replace in-memory Map rate limiter with Redis implementation (complexity: 3)
- [x] T-026: Add non-root user to Dockerfile.api (complexity: 2) **OBSOLETE: API migrated to Vercel serverless**
- [x] T-027: Gate docs routes behind NODE_ENV check in production (complexity: 2)
- [x] T-028: Fix wildcard subdomain matching in security.ts (complexity: 3)
- [x] T-029: Filter error details on 5xx responses in production (complexity: 2)

## Integration - Medium Severity Fixes (16 tasks)

- [x] T-030: Update cron middleware to block when CRON_SECRET not set (complexity: 2)
- [x] T-031: Add CRON_SECRET to env schema as required for production (complexity: 2)
- [x] T-032: Re-mount public exchange rate routes under /api/v1/public/ (complexity: 2)
- [x] T-033: Re-mount protected exchange rate routes under /api/v1/protected/ (complexity: 2)
- [x] T-034: Create admin exchange rate routes with createAdminRoute (complexity: 3)
- [x] T-035: Create shared sanitizeHtml utility for Astro pages (complexity: 3)
- [x] T-036: Apply sanitizeHtml to all Astro pages using set:html (complexity: 3)
- [x] T-037: Add force_https to fly.toml (complexity: 1) **OBSOLETE: API migrated to Vercel (HTTPS enforced by platform)**
- [x] T-038: Remove unused x-actor-id and x-user-id from CORS headers (complexity: 2)
- [x] T-039: Replace Content-Length body size check with Hono bodyLimit middleware (complexity: 2)
- [x] T-040: Refactor permission.ts to use PermissionEnum instead of role checks (complexity: 4)
- [x] T-041: Refactor accommodation.service.ts role checks to permission checks (complexity: 3)
- [x] T-042: Refactor post.service.ts and post.permissions.ts role checks (complexity: 3)
- [x] T-043: Update permission-related unit tests for refactored checks (complexity: 4)
- [x] T-044: Add admin role check to _authed.tsx route guard (complexity: 3)
- [x] T-045: Filter /auth/me response to exclude full permission array (complexity: 3)

## Testing (1 task)

- [x] T-021: Write integration tests for billing IDOR and metrics authorization (complexity: 4)

## Docs - Low Severity & Audit (3 tasks)

- [x] T-046: Audit account.dbschema.ts endpoints for password field exposure (complexity: 3)
- [x] T-047: Document cookie cache tradeoff in auth.ts comments (complexity: 1)
- [x] T-048: Document accepted risks in project security notes (complexity: 2)

## Cleanup - Verification (5 tasks)

- [x] T-049: Run npm audit and verify zero critical/high advisories (complexity: 2)
- [x] T-050: Run full test suite and verify all tests pass (complexity: 2)
- [x] T-051: Run typecheck and lint verification (complexity: 2)
- [~] T-052: Manual verification of all user stories on staging (complexity: 4) **DEFERRED to SPEC-025**
- [x] T-053: Verify Docker container runs as non-root on staging (complexity: 2) **OBSOLETE: API migrated to Vercel**

---

## Cross-Spec References

- **SPEC-024** (Credential Rotation & Git History Purge): Covers T-007 through T-011 (credential rotation, git purge, verification). 18 credentials across 4 priority tiers, rotation instructions per service, git-filter-repo execution plan.
- **SPEC-025** (Staging Environment Setup & Deployment Pipeline): Covers T-052 (manual verification on staging). Staging environment must exist before manual verification can proceed.

## Final Status Summary

- **Status: COMPLETED** (2026-03-02)
- Completed: 44 tasks (code-verified against codebase)
- Obsolete (counted as completed): 3 tasks (T-026, T-037, T-053) - API migrated from Fly.io/Docker to Vercel serverless
- Deferred to SPEC-024: 5 tasks (T-007, T-008, T-009, T-010, T-011) - credential rotation & git history purge
- Deferred to SPEC-025: 1 task (T-052) - manual verification on staging
- **17/18 applicable User Stories fulfilled. 1 deferred (US-02 → SPEC-024). 2 N/A (Vercel migration).**

## Notes

- T-023 uses silent clamping (Math.max/min) instead of returning 400 error. Safe but doesn't strictly match spec wording.
- T-025 added Redis as primary store but kept in-memory Map as fallback when HOSPEDA_REDIS_URL is not configured.
- T-040 centralized role checks in permission.ts getEntityPermission() function. Services themselves are clean of direct role comparisons.
- T-045/T-046 were already implemented but incorrectly marked as pending in previous state.
