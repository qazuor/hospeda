# SPEC-042-GAPS: CSP Security Gaps Remediation

> **Status**: approved
> **Priority**: HIGH
> **Complexity**: MEDIUM (27 atomic tasks, all <= 2.5 complexity)
> **Parent**: SPEC-042 CSP Nonce Integration

## Overview

Remediation of 27 confirmed gaps from SPEC-042 post-implementation gap analysis (8 audits, 52 gaps total). This spec covers only the gaps approved for immediate implementation. Gaps blocked by SPEC-045 (Vite 7), infrastructure, or domain definitions are tracked in `.claude/gaps-postergados.md`.

## Implementation Batches

### Batch 1: Critical Security Fixes

#### T-001: Scope permissive CSP to /docs only in route factory (GAP-042-39)

- Files: `apps/api/src/utils/route-factory.ts`
- Change: Move `unsafe-inline` + CDN CSP from ALL routes to only `/docs/*` routes. Non-docs routes use strict CSP from security.ts middleware.
- Complexity: 2.0

#### T-002: Remove inline onclick from 500.astro (GAP-042-42)

- Files: `apps/web/src/pages/500.astro`
- Change: Replace `onclick="window.location.reload()"` with `addEventListener` in a `<script>` tag. Add `id="retry-btn"` to button.
- Complexity: 1.0

#### T-003: Preserve non-CSP headers on /docs routes (GAP-042-30)

- Files: `apps/api/src/middlewares/security.ts`
- Change: Only bypass CSP for `/docs` paths, keep HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- Complexity: 1.5

### Batch 2: Astro Config + Simple Fixes

#### T-004: Disable experimental.csp in Astro config (GAP-042-03)

- Files: `apps/web/astro.config.mjs`
- Change: Remove `experimental: { csp: { ... } }` block (lines 137-160). CSP handled 100% via HTTP header middleware.
- Complexity: 1.0

#### T-005: Remove https: from web script-src (GAP-042-48)

- Files: `apps/web/src/middleware.ts`
- Change: Remove `https:` from `script-src` directive (line 111).
- Complexity: 1.0

#### T-006: Fix xXssProtection to '0' (GAP-042-37)

- Files: `apps/api/src/utils/env.ts`, `apps/api/src/utils/route-factory.ts`
- Change: Change default from `'1; mode=block'` to `'0'` in env.ts and route-factory.ts.
- Complexity: 1.0

#### T-007: Restrict API fontSrc (GAP-042-36)

- Files: `apps/api/src/middlewares/security.ts`
- Change: Change `fontSrc: ["'self'", 'https:', 'data:']` to `fontSrc: ["'self'"]`.
- Complexity: 1.0

### Batch 3: CSP Directive Additions

#### T-008: Add upgrade-insecure-requests to all 3 apps (GAP-042-26)

- Files: `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts`, `apps/api/src/middlewares/security.ts`
- Change: Add `upgrade-insecure-requests` directive to CSP in each app.
- Complexity: 1.5

#### T-009: Add media-src 'self' to web and admin CSP (GAP-042-35)

- Files: `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts`
- Change: Add `"media-src 'self'"` to CSP directives in both apps.
- Complexity: 1.0

#### T-010: Change Sentry domain to \*.sentry.io (GAP-042-29)

- Files: `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts`
- Change: Replace `*.ingest.sentry.io` with `*.sentry.io` in connect-src.
- Complexity: 1.0

#### T-011: Update default CSP env var in API (GAP-042-09)

- Files: `apps/api/src/utils/env.ts`
- Change: Update `API_SECURITY_CONTENT_SECURITY_POLICY` default to match actual strict policy, or remove if unused.
- Complexity: 1.0

### Batch 4: Admin CSP Improvements

#### T-012: Replace inline style animation with CSS class (GAP-042-50)

- Files: `apps/admin/src/router.tsx`, `apps/admin/src/styles.css`
- Change: Replace `style={{animation}}` with `className`. Create `.animate-router-pending` CSS class.
- Complexity: 1.5

#### T-013: Simplify VITE_SENTRY_DSN env access (GAP-042-44)

- Files: `apps/admin/src/middleware.ts`
- Change: Simplify to `process.env.VITE_SENTRY_DSN || ''` (server-side only).
- Complexity: 1.0

#### T-014: Restrict MercadoPago wildcard to specific subdomains (GAP-042-40)

- Files: `apps/admin/src/lib/csp-helpers.ts`
- Change: Replace `*.mercadopago.com` with `api.mercadopago.com`, `sdk.mercadopago.com`, `www.mercadopago.com`.
- Complexity: 1.5

#### T-015: Add static CSP-Report-Only header in admin vercel.json (GAP-042-51)

- Files: `apps/admin/vercel.json`
- Change: Add `Content-Security-Policy-Report-Only` static header as SSR fallback.
- Complexity: 1.5

### Batch 5: Header Unification

#### T-016: Add complete Permissions-Policy to web and admin (GAP-042-32)

- Files: `apps/web/vercel.json`, `apps/admin/vercel.json`
- Change: Add `payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()` to existing policy.
- Complexity: 1.5

#### T-017: Remove duplicate security headers from vercel.json (GAP-042-11)

- Files: `apps/web/vercel.json`, `apps/admin/vercel.json`, `apps/api/vercel.json`
- Change: Remove headers already set by middleware. Keep vercel.json only for Permissions-Policy, static CSP fallback, and cache headers.
- Complexity: 2.0

### Batch 6: Code Consolidation

#### T-018: Extract buildSentryReportUri to @repo/utils (GAP-042-08)

- Files: `packages/utils/src/sentry.ts` (new), `packages/utils/src/index.ts`, `apps/web/src/lib/middleware-helpers.ts`, `apps/admin/src/lib/csp-helpers.ts`
- Change: Move function to shared package, update imports, add tests.
- Complexity: 2.5

### Batch 7: Tests

#### T-019: Add missing CSP helper tests (GAP-042-23)

- Files: `apps/admin/test/lib/csp-helpers.test.ts`
- Change: Add 3-4 tests for spec-required edge cases.
- Complexity: 2.0

#### T-020: Add nonce security tests (GAP-042-41)

- Files: `apps/admin/test/lib/csp-nonce.test.ts` (new)
- Change: Test nonce uniqueness, entropy (22 chars base64url), format, crypto source.
- Complexity: 2.0

#### T-021: Add CSP header integration tests (GAP-042-06)

- Files: `apps/web/test/middleware/csp-headers.test.ts` (new), `apps/admin/test/middleware/csp-headers.test.ts` (new)
- Change: Integration tests verifying CSP headers appear in responses with correct directives.
- Complexity: 2.5

### Batch 8: CI/CD

#### T-022: Add CI check for CSP-incompatible patterns (GAP-042-46)

- Files: `.github/workflows/ci.yml` or `scripts/check-csp-patterns.sh` (new)
- Change: Grep for onclick=, onload=, eval(, new Function(, javascript: in .astro/.tsx files.
- Complexity: 2.0

#### T-023: Add CSP header validation in CI (GAP-042-24)

- Files: `scripts/validate-csp.ts` (new) or test file
- Change: Validate CSP directives from all apps have required security properties.
- Complexity: 2.5

### Batch 9: Documentation

#### T-024: Document setResponseHeader usage (GAP-042-20)

- Files: `apps/admin/src/middleware.ts`
- Change: Add JSDoc explaining why setResponseHeader() is used vs spec's pattern.
- Complexity: 1.0

#### T-025: Document all inline scripts in web app (GAP-042-22)

- Files: `apps/web/docs/csp-inline-scripts.md` (new)
- Change: List all components with script tags, their purpose, and CSP handling.
- Complexity: 1.5

### Batch 10: Verification

#### T-026: Verify web build (GAP-042-16)

- Files: None (verification)
- Change: Run `pnpm build` for web app, fix if broken.
- Complexity: 1.0

#### T-027: Verify admin build (GAP-042-17)

- Files: None (verification)
- Change: Run `pnpm build` for admin app, fix if broken.
- Complexity: 1.0

## Dependencies

```
Batch 1 (Critical)     ─┐
Batch 2 (Config/Simple) ─┼─ Parallel
Batch 4 (Admin CSP)    ─┘
         │
         v
Batch 3 (Directives) → Batch 5 (Headers) → Batch 6 (Consolidation)
         │
         v
Batch 7 (Tests) + Batch 8 (CI/CD) → Batch 9 (Docs) → Batch 10 (Verify)
```

## Out of Scope

- Gaps blocked by SPEC-045 (Vite 7): GAP-042-01, 13, 18, 19, 21
- Gaps blocked by domain definitions: GAP-042-27, 31, 38
- Gaps blocked by deploy/infra: GAP-042-07, 12, 15, 43
- Phase 2/3 enhancements: GAP-042-05, 10, 14, 25, 28, 33, 34, 45
