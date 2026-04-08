# TODOs: Security Gaps Remediation (SPEC-019 Post-Audit)

Spec: SPEC-037 | Status: pending | Progress: 0/32

## Setup
- [ ] T-001: Create USER_BOOKMARK_VIEW_ANY and METRICS_RESET permissions (complexity: 3) [blocks T-014, T-015]
- [ ] T-002: Add _isSystemActor flag to Actor type (complexity: 2) [blocks T-011]

## Core - Crypto & Auth
- [ ] T-003: Use timingSafeEqual for CRON_SECRET + min(32) for BETTER_AUTH_SECRET (complexity: 2)
- [ ] T-004: Replace string literals with RoleEnum.HOST and isGuestActor() (complexity: 2)
- [ ] T-005: OAuth cross-validation + replace Math.random() in utils and request-id (complexity: 3)

## Core - Information Leak Prevention
- [ ] T-006: Sanitize health endpoints - remove DB error details and NODE_ENV (complexity: 3)
- [ ] T-007: Remove PII from logs + mask billing data + fix password logging (complexity: 3)
- [ ] T-008: Sanitize file.name in error responses + generic billing-usage errors (complexity: 3)

## Core - Rate Limiting & Middleware
- [ ] T-009: Fix rate limiting: trust proxy docs, signout auth, path classification, contact limit (complexity: 3)
- [ ] T-010: Remove dead sanitization code from validation middleware (complexity: 2)
- [ ] T-011: Add runtime guard rejecting system actors from HTTP context (complexity: 2) [blocked by T-002]

## Core - Permission Consistency
- [ ] T-012: Remove SUPER_ADMIN role bypasses in authorization and permission utils (complexity: 3)
- [ ] T-013: Fix direct role checks in promo-codes routes (complexity: 2)
- [ ] T-014: Add UserBookmark ownership verification + admin permission bypass (complexity: 4) [blocked by T-001]
- [ ] T-015: Add METRICS_RESET permission check + billing ownership fail-closed (complexity: 3) [blocked by T-001]

## Core - Webhook & Transactions
- [ ] T-016: Wrap webhook subscription update + audit log in database transaction (complexity: 3)
- [ ] T-017: Remove deprecated webhookEventIds Map + add Redis fallback logging (complexity: 2)

## Core - Route Architecture Migration
- [ ] T-018: Delete orphan exchange-rate write files in protected tier (complexity: 1) [blocks T-019]
- [ ] T-019: Remove exchange-rate protected tier duplication (complexity: 3) [blocked by T-018]
- [ ] T-020: Consolidate cron routes - document /api/v1/cron as internal-only (complexity: 3)
- [ ] T-021: Move billing admin-only operations from protected to admin tier (complexity: 4)
- [ ] T-022: Move reports admin operations to admin tier (complexity: 2)

## Core - XSS & Frontend Security
- [ ] T-023: Fix JSON-LD XSS in Breadcrumb and propietarios Astro components (complexity: 2)
- [ ] T-024: Add UUID validation to accommodation route parameters (complexity: 2)
- [ ] T-025: Add Content-Security-Policy-Report-Only headers to web and admin (complexity: 3)

## Core - CI/CD & Tooling
- [ ] T-026: Fix CI audit blocking for critical/high vulnerabilities (complexity: 2)
- [ ] T-027: Fix GitHub workflow inconsistencies (Node version, pnpm action, engines) (complexity: 2)

## Cleanup
- [ ] T-028: Replace console.error/console.warn with structured logger (complexity: 2)
- [ ] T-029: Clean bookmark permissions dead code + error type guard in event-handler (complexity: 2)
- [ ] T-030: Update documentation examples to use PermissionEnum (complexity: 2)

## Docs
- [ ] T-031: Update ACCEPTED_RISKS.md with SEC-IDs and new accepted risks (complexity: 2)
- [ ] T-032: Fix CORS docs + document undocumented cron jobs (complexity: 2)

---

## Dependency Graph

```
T-001 ──┬──> T-014 (bookmark ownership)
        └──> T-015 (metrics reset + billing fail-closed)

T-002 ────> T-011 (system actor runtime guard)

T-018 ────> T-019 (exchange rate cleanup)

All other tasks are independent.
```

## Gap Coverage Map

| Task | Gaps |
|------|------|
| T-001 | GAP-27, GAP-21 |
| T-002 | GAP-48 |
| T-003 | GAP-23, GAP-40 |
| T-004 | GAP-24, GAP-16 |
| T-005 | GAP-39, GAP-52, GAP-56 |
| T-006 | GAP-25, GAP-35 |
| T-007 | GAP-29, GAP-11, GAP-46, GAP-66 |
| T-008 | GAP-58, GAP-61 |
| T-009 | GAP-03, GAP-30, GAP-43, GAP-62 |
| T-010 | GAP-41, GAP-42 |
| T-011 | GAP-48 |
| T-012 | GAP-05 |
| T-013 | GAP-33 |
| T-014 | GAP-27, GAP-47 |
| T-015 | GAP-21, GAP-49 |
| T-016 | GAP-04 |
| T-017 | GAP-31, GAP-20 |
| T-018 | GAP-32 |
| T-019 | GAP-22 |
| T-020 | GAP-14 |
| T-021 | GAP-14 |
| T-022 | GAP-14 |
| T-023 | GAP-06 |
| T-024 | GAP-28 |
| T-025 | GAP-45 |
| T-026 | GAP-12 |
| T-027 | GAP-55, GAP-63, GAP-64 |
| T-028 | GAP-36, GAP-59 |
| T-029 | GAP-17, GAP-60 |
| T-030 | GAP-57 |
| T-031 | GAP-18, GAP-08, GAP-44, GAP-65 |
| T-032 | GAP-19, GAP-54 |
