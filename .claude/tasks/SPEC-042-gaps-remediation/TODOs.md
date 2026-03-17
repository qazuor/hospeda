# SPEC-042-GAPS: CSP Security Gaps Remediation

## Progress: 0/27 tasks (0%)

**Average Complexity:** 1.4/2.5 (max)
**Critical Path:** T-004 -> T-008 -> T-016 -> T-017 (4 steps)
**Parallel Tracks:** 5 identified (Batches 1, 2, 4 can run in parallel)

---

### Core Phase (15 tasks)

#### Batch 1: Critical Security Fixes

- [ ] **T-001** (complexity: 2) - Scope permissive CSP to /docs only in route factory
  - GAP-042-39 | Files: route-factory.ts
  - Blocked by: none | Blocks: T-019

- [ ] **T-002** (complexity: 1) - Remove inline onclick from 500.astro
  - GAP-042-42 | Files: 500.astro
  - Blocked by: none | Blocks: T-022

- [ ] **T-003** (complexity: 2) - Preserve non-CSP headers on /docs routes
  - GAP-042-30 | Files: security.ts
  - Blocked by: none | Blocks: T-017

#### Batch 2: Astro Config + Simple Fixes

- [ ] **T-004** (complexity: 1) - Disable experimental.csp in Astro config
  - GAP-042-03 | Files: astro.config.mjs
  - Blocked by: none | Blocks: T-005, T-008, T-009

- [ ] **T-005** (complexity: 1) - Remove https: from web script-src
  - GAP-042-48 | Files: middleware.ts (web)
  - Blocked by: T-004 | Blocks: T-021

- [ ] **T-006** (complexity: 1) - Fix xXssProtection to '0'
  - GAP-042-37 | Files: env.ts, route-factory.ts
  - Blocked by: none | Blocks: T-017

- [ ] **T-007** (complexity: 1) - Restrict API fontSrc to self only
  - GAP-042-36 | Files: security.ts
  - Blocked by: none | Blocks: none

#### Batch 3: CSP Directive Additions

- [ ] **T-008** (complexity: 2) - Add upgrade-insecure-requests to all 3 apps
  - GAP-042-26 | Files: middleware.ts, csp-helpers.ts, security.ts
  - Blocked by: T-004 | Blocks: T-016, T-019, T-021

- [ ] **T-009** (complexity: 1) - Add media-src 'self' to web and admin CSP
  - GAP-042-35 | Files: middleware.ts, csp-helpers.ts
  - Blocked by: T-004 | Blocks: T-019, T-021

- [ ] **T-010** (complexity: 1) - Change Sentry domain to *.sentry.io
  - GAP-042-29 | Files: middleware.ts, csp-helpers.ts
  - Blocked by: none | Blocks: T-018

- [ ] **T-011** (complexity: 1) - Update default CSP env var in API
  - GAP-042-09 | Files: env.ts
  - Blocked by: none | Blocks: none

#### Batch 4: Admin CSP Improvements

- [ ] **T-012** (complexity: 1) - Replace inline style animation with CSS class
  - GAP-042-50 | Files: router.tsx, styles.css
  - Blocked by: none | Blocks: none

- [ ] **T-013** (complexity: 1) - Simplify VITE_SENTRY_DSN env access
  - GAP-042-44 | Files: middleware.ts (admin)
  - Blocked by: none | Blocks: none

- [ ] **T-014** (complexity: 2) - Restrict MercadoPago wildcard to specific subdomains
  - GAP-042-40 | Files: csp-helpers.ts
  - Blocked by: none | Blocks: T-019

- [ ] **T-015** (complexity: 2) - Add static CSP-Report-Only in admin vercel.json
  - GAP-042-51 | Files: admin/vercel.json
  - Blocked by: none | Blocks: T-017

### Integration Phase (5 tasks)

- [ ] **T-016** (complexity: 1) - Add complete Permissions-Policy to web/admin
  - GAP-042-32 | Files: web/vercel.json, admin/vercel.json
  - Blocked by: T-008 | Blocks: T-017

- [ ] **T-017** (complexity: 2) - Remove duplicate security headers from vercel.json
  - GAP-042-11 | Files: all 3 vercel.json
  - Blocked by: T-003, T-006, T-015, T-016 | Blocks: none

- [ ] **T-018** (complexity: 2) - Extract buildSentryReportUri to @repo/utils
  - GAP-042-08 | Files: packages/utils, middleware-helpers.ts, csp-helpers.ts
  - Blocked by: T-010 | Blocks: T-019

- [ ] **T-022** (complexity: 2) - Add CI check for CSP-incompatible patterns
  - GAP-042-46 | Files: ci.yml, scripts/
  - Blocked by: T-002 | Blocks: none

- [ ] **T-023** (complexity: 2) - Add CSP header validation in CI
  - GAP-042-24 | Files: scripts/validate-csp.test.ts
  - Blocked by: none | Blocks: none

### Testing Phase (5 tasks)

- [ ] **T-019** (complexity: 2) - Add missing CSP helper tests
  - GAP-042-23 | Files: csp-helpers.test.ts
  - Blocked by: T-001, T-008, T-009, T-014, T-018 | Blocks: none

- [ ] **T-020** (complexity: 2) - Add nonce security tests
  - GAP-042-41 | Files: csp-nonce.test.ts (new)
  - Blocked by: none | Blocks: none

- [ ] **T-021** (complexity: 2) - Add CSP header integration tests
  - GAP-042-06 | Files: csp-headers.test.ts (new, web + admin)
  - Blocked by: T-005, T-008, T-009 | Blocks: none

- [ ] **T-026** (complexity: 1) - Verify web build
  - GAP-042-16 | Verification only
  - Blocked by: T-004, T-005, T-008, T-009 | Blocks: none

- [ ] **T-027** (complexity: 1) - Verify admin build
  - GAP-042-17 | Verification only
  - Blocked by: T-012, T-013, T-014, T-015 | Blocks: none

### Docs Phase (2 tasks)

- [ ] **T-024** (complexity: 1) - Document setResponseHeader usage
  - GAP-042-20 | Files: middleware.ts (admin)
  - Blocked by: none | Blocks: none

- [ ] **T-025** (complexity: 2) - Document all inline scripts in web app
  - GAP-042-22 | Files: csp-inline-scripts.md (new)
  - Blocked by: none | Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-003, T-004, T-006, T-007, T-010, T-011, T-012, T-013, T-014, T-015, T-020, T-023, T-024, T-025
Level 1: T-005, T-008, T-009, T-018, T-022
Level 2: T-016, T-021, T-026
Level 3: T-017, T-019
Level 4: T-027

## Suggested Start

Begin with **T-001** (complexity: 2) - Critical security fix, no dependencies, unblocks T-019.
In parallel: T-002, T-003, T-004, T-006, T-007, T-010-T-015, T-020, T-023-T-025.
