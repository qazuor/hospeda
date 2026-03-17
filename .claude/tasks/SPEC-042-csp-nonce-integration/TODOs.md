# SPEC-042: CSP Nonce/Hash Integration

## Progress: 0/20 tasks (0%)

**Average Complexity:** 2.1/4
**Critical Path:** T-001 -> T-005 -> T-007 -> T-016 -> T-017 -> T-020 (6 steps)
**Parallel Tracks:** 3 identified (web, admin, shared setup)

---

### Setup Phase

- [ ] **T-001** (complexity: 1) - Verify Astro version >= 5.9.0 and document minimum in package.json
  - Update apps/web/package.json astro version to ^5.9.0
  - Blocked by: none
  - Blocks: T-005, T-006

- [ ] **T-002** (complexity: 3) - Upgrade TanStack Start packages to >= 1.166.0
  - Upgrade all @tanstack packages in apps/admin, review CHANGELOG, run tests
  - Blocked by: none
  - Blocks: T-008, T-009, T-010, T-011

- [ ] **T-003** (complexity: 2) - Run pre-implementation verification checklist
  - Verify no ClientRouter, confirm transition:name files, check Sentry inline scripts
  - Blocked by: none
  - Blocks: T-005, T-008

- [ ] **T-004** (complexity: 1) - Add Sentry DSN env var placeholders to .env.example files
  - Add PUBLIC_SENTRY_DSN (web) and VITE_SENTRY_DSN (admin)
  - Blocked by: none
  - Blocks: T-006, T-012

### Core Phase

- [ ] **T-005** (complexity: 2) - Configure Astro experimental.csp in astro.config.mjs
  - Add experimental.csp block with algorithm, scriptDirective, directives
  - Blocked by: T-001, T-003
  - Blocks: T-017

- [ ] **T-006** (complexity: 2) - Add buildSentryReportUri to web middleware-helpers.ts
  - Parse Sentry DSN and return security endpoint URL
  - Blocked by: T-001, T-004
  - Blocks: T-007, T-013

- [ ] **T-007** (complexity: 3) - Add CSP header logic to web middleware.ts (Step 7)
  - Set Content-Security-Policy-Report-Only on HTML responses
  - Blocked by: T-006
  - Blocks: T-017

- [ ] **T-008** (complexity: 1) - Remove CSP header from web vercel.json
  - Remove static CSP header, keep other security headers
  - Blocked by: T-003
  - Blocks: T-017

- [ ] **T-009** (complexity: 2) - Move inline keyframe animation from router.tsx to styles.css
  - Move @keyframes router-pending-bar to CSS, remove inline <style>
  - Blocked by: T-002
  - Blocks: T-011

- [ ] **T-010** (complexity: 3) - Create CSP helpers module for admin app
  - Create csp-helpers.ts with buildSentryReportUri and buildCspDirectives
  - Blocked by: T-002
  - Blocks: T-012, T-014

- [ ] **T-011** (complexity: 3) - Update router.tsx to consume CSP nonce via createIsomorphicFn
  - Add getCspNonce, ssr.nonce to createRouter
  - Blocked by: T-002, T-009
  - Blocks: T-012, T-018

- [ ] **T-012** (complexity: 3) - Create CSP middleware and start.ts for admin app
  - Create middleware.ts (nonce generation) and start.ts (middleware registration)
  - Blocked by: T-010, T-011, T-004
  - Blocks: T-018

- [ ] **T-015** (complexity: 1) - Remove CSP header from admin vercel.json
  - Remove static CSP header, keep other security headers
  - Blocked by: T-002
  - Blocks: T-018

### Testing Phase

- [ ] **T-013** (complexity: 2) - Write unit tests for web buildSentryReportUri
  - Test valid DSN, invalid DSN, missing parts
  - Blocked by: T-006
  - Blocks: T-019

- [ ] **T-014** (complexity: 2) - Write unit tests for admin CSP helpers
  - Test buildSentryReportUri and buildCspDirectives
  - Blocked by: T-010
  - Blocks: T-019

- [ ] **T-019** (complexity: 1) - Run final regression test suite
  - pnpm lint && pnpm typecheck && pnpm test
  - Blocked by: T-013, T-014
  - Blocks: T-020

### Integration Phase

- [ ] **T-016** (complexity: 2) - Run full quality gate after all code changes
  - pnpm lint, typecheck, test from monorepo root
  - Blocked by: T-005, T-007, T-008, T-009, T-010, T-011, T-012, T-013, T-014, T-015
  - Blocks: T-017, T-018

- [ ] **T-017** (complexity: 3) - Verify web app CSP via build + preview
  - Verify meta tag hashes, HTTP header, no violations, all features work
  - Blocked by: T-005, T-007, T-008, T-016
  - Blocks: T-020

- [ ] **T-018** (complexity: 3) - Verify admin app CSP nonce generation and propagation
  - Verify nonce in headers, script tags, meta tag, different per request
  - Blocked by: T-012, T-015, T-016
  - Blocks: T-020

### Docs Phase

- [ ] **T-020** (complexity: 2) - Document findings and Session Replay behavior
  - Document Session Replay, MercadoPago antifraud, CSP violations
  - Blocked by: T-017, T-018, T-019
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-002, T-003, T-004
Level 1: T-005, T-006, T-008, T-009, T-010, T-015
Level 2: T-007, T-011, T-013, T-014
Level 3: T-012
Level 4: T-016, T-019
Level 5: T-017, T-018
Level 6: T-020
```

## Parallel Tracks

**Track A (Web):** T-001 -> T-005, T-006 -> T-007 -> T-008 -> T-017
**Track B (Admin):** T-002 -> T-009 -> T-011 -> T-012 -> T-018
**Track C (Admin helpers):** T-002 -> T-010 -> T-014

## Suggested Start

Begin with **T-001** (complexity: 1), **T-002** (complexity: 3), **T-003** (complexity: 2), and **T-004** (complexity: 1) in parallel - they have no dependencies and unblock all downstream work.
