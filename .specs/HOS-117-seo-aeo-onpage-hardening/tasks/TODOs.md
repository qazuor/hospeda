# HOS-117: SEO/AEO on-page hardening

## Progress: 0/21 tasks (0%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-002 → T-006 → T-018 → T-021 (4 steps)
**Parallel Tracks:** 4 (Wave 0 fixes, Wave 1 exclusion, Wave 2 polish, Wave 4 rendering)

> Ordered by priority: quick, high-credibility wins first (Wave 0), then owner P1
> demo-exclusion, then P2 polish, then i18n + rendering, then testing + docs.
> Open questions (OQ-1/OQ-2/OQ-4/OQ-6) are decided at the start of their wave.

---

### Setup & Audit Phase

- [ ] **T-001** (complexity: 3) - Audit client:* islands for SSR↔hydration critical-content mismatch
  - Enumerate islands showing critical content; produce compliance checklist. (US-2)
  - Blocked by: none
  - Blocks: T-004, T-005

- [ ] **T-002** (complexity: 2) - Confirm thin-content predicate and destination count fields
  - Verify emptiness predicate + shared-helper location. (US-3)
  - Blocked by: none
  - Blocks: T-006

- [ ] **T-003** (complexity: 2) - Capture baseline CWV measurement and page inventory
  - Baseline LCP/CLS/INP + page inventory for Wave 4. (US-10)
  - Blocked by: none
  - Blocks: T-015, T-017

### Wave 0 — Credibility Bugs (P0)

- [ ] **T-004** (complexity: 3) - Fix homepage stat counters to SSR the final value
  - Progressive enhancement; reuse home-guards fallback. (US-1)
  - Blocked by: T-001
  - Blocks: T-018

- [ ] **T-005** (complexity: 3) - Fix flagged islands + document SSR-emits-final-datum principle
  - Regression test per island; rule in apps/web/CLAUDE.md. (US-2)
  - Blocked by: T-001
  - Blocks: T-018

- [ ] **T-006** (complexity: 3) - noindex empty destinations + exclude from sitemap
  - Single shared predicate across page + sitemap. (US-3)
  - Blocked by: T-002
  - Blocks: T-018

- [ ] **T-007** (complexity: 2) - Add BreadcrumbJsonLd to gastronomy/experiences + extend CI guard to 6
  - Root-cause fix so gap can't regrow. (US-4)
  - Blocked by: none
  - Blocks: T-018

### Wave 1 — Demo-Content Exclusion (P1)

- [ ] **T-008** (complexity: 2) - Decide exclusion mechanism (OQ-1/OQ-4) with tradeoffs
  - Coarse vs granular; full-site vs selective noindex. (US-5)
  - Blocked by: none
  - Blocks: T-009

- [ ] **T-009** (complexity: 3) - Implement chosen demo-content exclusion mechanism
  - Real content indexable by flag/env flip, not logic change. (US-5)
  - Blocked by: T-008
  - Blocks: T-010, T-019

- [ ] **T-010** (complexity: 3) - Add granular isSeed/noIndex flag if OQ-1 = granular
  - Schema migration + seed dual-write. Skip if coarse. (US-5)
  - Blocked by: T-009
  - Blocks: T-019

### Wave 2 — Coverage & Polish (P2)

- [ ] **T-011** (complexity: 3) - Raise FAQ coverage to the OQ-6 target
  - Real FAQ content via seed dual-write. (US-6)
  - Blocked by: none
  - Blocks: T-020

- [ ] **T-012** (complexity: 2) - Review landings for unique prose; decide geo×type dimension
  - Avoid near-duplicate doorway pages. (US-7)
  - Blocked by: none
  - Blocks: none

- [ ] **T-013** (complexity: 1) - Update json-ld-audit.md to typed-component reality
  - Point at the CI guard as the contract. (US-8)
  - Blocked by: T-007
  - Blocks: none

### Wave 3 — Content i18n (P2, likely sub-spec)

- [ ] **T-014** (complexity: 3) - Wave 3 content i18n — macro task (decide OQ-2 split first)
  - Kept unsplit; atomize via /replan if kept here. (US-9)
  - Blocked by: none
  - Blocks: T-020

### Wave 4 — Rendering Strategy & CWV (P2, measurement-gated)

- [ ] **T-015** (complexity: 2) - Classify pages: prerender / SSR+edge-cache / pure-SSR
  - Document SSR-vs-prerender anti-myth. (US-10)
  - Blocked by: T-003
  - Blocks: T-016

- [ ] **T-016** (complexity: 3) - Verify Cloudflare edge caching; prerender truly-static pages
  - Evidence on Linear issue. (US-10)
  - Blocked by: T-015
  - Blocks: T-017

- [ ] **T-017** (complexity: 2) - Measurement-gated CWV fixes (before/after)
  - No perf fix without numbers (OQ-3). (US-10)
  - Blocked by: T-016
  - Blocks: none

### Testing Phase

- [ ] **T-018** (complexity: 3) - Wave 0 raw-SSR-HTML tests
  - Counters, empty-destination noindex+sitemap, 6/6 Breadcrumb. (US-1..US-4)
  - Blocked by: T-004, T-005, T-006, T-007
  - Blocks: T-021

- [ ] **T-019** (complexity: 2) - Wave 1 demo-exclusion toggle test
  - Toggle → real indexable, demo not. (US-5)
  - Blocked by: T-009, T-010
  - Blocks: T-021

- [ ] **T-020** (complexity: 2) - Wave 2/3 seed-coverage and i18n fallback tests
  - FAQ target + resolveI18nText fallback. (US-6/US-9)
  - Blocked by: T-011, T-014
  - Blocks: T-021

### Docs & Cleanup Phase

- [ ] **T-021** (complexity: 2) - Docs, closeout, and off-page follow-up
  - Off-page gap as follow-up; closeout; smoke labels. (US-8)
  - Blocked by: T-018, T-019, T-020
  - Blocks: none

---

## Dependency Graph (levels)

- **Level 0:** T-001, T-002, T-003, T-007, T-008, T-011, T-012, T-014
- **Level 1:** T-004, T-005, T-006, T-009, T-013, T-015
- **Level 2:** T-010, T-016, T-018
- **Level 3:** T-017, T-019, T-020
- **Level 4:** T-021

## Suggested Start

Begin with **T-007** (complexity: 2, no deps) for an immediate quick win, or the
**T-001 → T-004** counter chain — the single highest-impact credibility fix.
