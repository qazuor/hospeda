# SPEC-142: CSP Phase 2 + remaining SPEC-046 coverage gaps

## Progress: 0/28 tasks (0%)

**Average Complexity:** 1.8/3 (max)
**Critical Path:** T-001 → T-003 → T-004 → T-005 → T-010 → T-011 → T-012 → T-015 → T-017 → T-020 → T-021 → T-028 (12 steps)
**Parallel Tracks:** 4 identified (2.A crawl + 2.B MP Brick + 2.C home fix + 2.E optional cleanups)

---

### Setup Phase

- [ ] **T-001** (complexity: 1) — Audit current CSP middleware config and document baseline state
  - Read middleware-helpers.ts, list all directives, report-uri, middleware route scope
  - Blocked by: none
  - Blocks: T-002, T-003, T-006

- [ ] **T-002** (complexity: 2) — Reproduce public-pages CSP crawl baseline (T-014 scope)
  - Crawl /, /es/, /es/alojamientos/, /es/destinos/, /es/blog/ — capture console violations
  - Blocked by: T-001
  - Blocks: T-016

### Core Phase

#### 2.C — Home CSP header fix

- [ ] **T-003** (complexity: 2) — Diagnose why /es/ home route does not emit CSP header
  - curl -I /es/, debug log in middleware, check Astro prerender/Traefik
  - Blocked by: T-001
  - Blocks: T-004

- [ ] **T-004** (complexity: 3) — Implement fix for home CSP header emission
  - Fix in middleware-helpers.ts / middleware.ts / astro.config.ts per T-003 diagnosis
  - Blocked by: T-003
  - Blocks: T-005, T-018

- [ ] **T-005** (complexity: 1) — Verify /es/ home route now emits CSP header on staging
  - curl -I staging /es/ — confirm header present and matches other routes
  - Blocked by: T-004
  - Blocks: T-007, T-008, T-009, T-010, T-019

#### 2.A — Authenticated crawl setup

- [ ] **T-006** (complexity: 1) — Set up staging authenticated session for crawl
  - HOST role account with accommodation + subscription; capture session cookie
  - Blocked by: T-001
  - Blocks: T-007, T-008, T-009, T-010

#### 2.A — Authenticated crawl (parallel tracks after T-005 + T-006)

- [ ] **T-007** (complexity: 2) — Crawl auth flows authenticated
  - sign-in, sign-up, OAuth callback + form submission — log all CSP violations
  - Blocked by: T-005, T-006
  - Blocks: T-016

- [ ] **T-008** (complexity: 2) — Crawl mi-cuenta routes authenticated
  - favoritos, colecciones, historial + island interactions
  - Blocked by: T-005, T-006
  - Blocks: T-016

- [ ] **T-009** (complexity: 2) — Crawl owner routes authenticated
  - propiedades/* with file upload and image previews
  - Blocked by: T-005, T-006
  - Blocks: T-016

- [ ] **T-010** (complexity: 3) — Crawl checkout → MercadoPago Brick load with CSP capture
  - precios → checkout with MP sandbox session; capture ALL violations per directive
  - Blocked by: T-005, T-006
  - Blocks: T-011

#### 2.B — MP Brick CSP

- [ ] **T-011** (complexity: 2) — Research MP Brick CSP requirements
  - Map T-010 violations to directive/domain; produce {directive, domain, reason} table
  - Blocked by: T-010
  - Blocks: T-012, T-013, T-014

- [ ] **T-012** (complexity: 2) — Add frame-src entries for mercadopago.com and mlstatic.com
  - Current frame-src is 'none'; MP Brick needs PCI iframe allowlist
  - Blocked by: T-011
  - Blocks: T-015

- [ ] **T-013** (complexity: 1) — Add connect-src entry for api.mercadopago.com
  - Blocked by: T-011
  - Blocks: T-015

- [ ] **T-014** (complexity: 1) — Add img-src and font-src entries for mlstatic.com
  - Card-type icons and webfonts from mlstatic
  - Blocked by: T-011
  - Blocks: T-015

- [ ] **T-020** (complexity: 1) — Flip header: Report-Only → Content-Security-Policy (Phase 2)
  - ONE-LINE CHANGE in middleware-helpers.ts. Pre-req: T-017 must be green.
  - Blocked by: T-017
  - Blocks: T-021

### Integration Phase

- [ ] **T-015** (complexity: 2) — Deploy CSP config + verify MP Brick loads without CSP errors
  - Coolify redeploy → checkout with MP sandbox → zero console errors → test payment
  - Blocked by: T-012, T-013, T-014
  - Blocks: T-017

- [ ] **T-016** (complexity: 2) — Consolidate authenticated crawl logs into structured report
  - Merge T-007/T-008/T-009 logs + T-002 baseline; draft assertions (a)-(g)
  - Blocked by: T-002, T-007, T-008, T-009
  - Blocks: T-017, T-027

- [ ] **T-017** (complexity: 1) — Verify zero net-new violation types in Sentry trailing 7 days
  - Pre-flip gate. Sentry dashboard → last 7d → count distinct new types = 0
  - Blocked by: T-015, T-016
  - Blocks: T-020

- [ ] **T-021** (complexity: 2) — Deploy Phase 2 enforce to staging + 48h soak monitoring
  - Monitor Sentry blocks at 4h/12h/24h/48h; rollback = one-line revert
  - Blocked by: T-020
  - Blocks: T-022, T-028

### Testing Phase

- [ ] **T-018** (complexity: 2) — Write unit tests for CSP middleware home-route header emission
  - apps/web/src/lib/**tests**/csp-middleware.test.ts — /es/ emits header
  - Blocked by: T-004
  - Blocks: none

- [ ] **T-019** (complexity: 2) — Write integration test: /es/ route emits CSP header
  - HTTP test: startTestServer → fetch /es/ → assert header present
  - Blocked by: T-005
  - Blocks: none

- [ ] **T-022** (complexity: 2) — Write regression test for enforce-mode header name
  - csp-middleware.test.ts: assert header = Content-Security-Policy (not Report-Only)
  - Blocked by: T-021
  - Blocks: none

### Cleanup Phase (Optional — 2.E)

- [ ] **T-023** (complexity: 2) — [OPTIONAL] Add Sentry beforeSend filter for eval-probe reports
  - Drop CSP events where violatedDirective='script-src' AND blockedUri contains 'eval'
  - Blocked by: none (can be done anytime)
  - Blocks: none

- [ ] **T-024** (complexity: 2) — [OPTIONAL] Logo-pattern blind-spot sweep
  - grep -rE 'style=.*\${' apps/web/src/ — audit enum-safe vs dynamic interpolations
  - Blocked by: none
  - Blocks: none

- [ ] **T-025** (complexity: 2) — [OPTIONAL] Fix Sentry environment config (HOSPEDA_ENV wiring)
  - Wire PUBLIC_HOSPEDA_ENV to Sentry environment; add to env registry + .env.example
  - Blocked by: none
  - Blocks: none

- [ ] **T-026** (complexity: 1) — [OPTIONAL] Bump staging tracing sample-rate to 1.0 via env
  - PUBLIC_SENTRY_TRACES_SAMPLE_RATE env-controlled; tell user to set 1.0 in Coolify staging
  - Blocked by: none
  - Blocks: none

### Docs Phase

- [ ] **T-027** (complexity: 2) — Write and commit verification-authenticated-YYYY-MM-DD.md report
  - Formal report with assertions (a)-(g); commit to spec branch
  - Blocked by: T-016
  - Blocks: none

- [ ] **T-028** (complexity: 1) — Update CLAUDE.md + docs + close spec in indexes
  - CSP enforce status, MP Brick domains; flip spec.md to completed; index-sync
  - Blocked by: T-021
  - Blocks: none

---

## Dependency Graph

```
Level 0:  T-001
Level 1:  T-002, T-003, T-006
Level 2:  T-004, T-007 (partial), T-008 (partial), T-009 (partial), T-010 (partial)
Level 3:  T-005, T-018
Level 4:  T-007, T-008, T-009, T-010, T-019
Level 5:  T-011, T-016 (partial)
Level 6:  T-012, T-013, T-014
Level 7:  T-015, T-016
Level 8:  T-017, T-027
Level 9:  T-020
Level 10: T-021
Level 11: T-022, T-028
```

**Independent (no deps):** T-023, T-024, T-025, T-026

## Suggested Start

Begin with **T-001** (complexity: 1) — no dependencies, unblocks T-002, T-003, and T-006.

After T-001: start T-002, T-003, and T-006 **in parallel** (no inter-deps).

**Workstream summary:**

- 2.A Authenticated crawl: T-006 → T-007/T-008/T-009 → T-016 → T-017
- 2.B MP Brick: T-010 → T-011 → T-012/T-013/T-014 → T-015 → T-017
- 2.C Home fix: T-003 → T-004 → T-005 (gates the crawl tasks)
- 2.D Phase 2 flip: T-017 → T-020 → T-021
- 2.E Optional cleanups: T-023, T-024, T-025, T-026 (any time)
