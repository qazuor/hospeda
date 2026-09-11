# HOS-1156: One publish page per vertical

## Progress: 0/30 tasks (0%)

**Average complexity:** 2.3 / 3 (max) — every task ≤ 3, none flagged
**Critical path:** T-005 → T-006 → T-009 → T-016 → T-017 → T-019 → T-023 → T-025 → T-028 → T-030 (10 steps)
**Parallel tracks:** 4 independent starts (i18n, API, schema, behaviour-freeze)
**Depth:** 10 levels, 0 cycles

---

## Setup Phase

- [ ] **T-001** (complexity: 2) — Add the shared publish-page i18n keys (es)
  - The structural keys the three pages share. Copy itself is per vertical.
  - Blocked by: none · Blocks: T-002, T-003, T-017, T-018

- [ ] **T-002** (complexity: 2) — Write the gastronomy publish-page copy (es)
  - Its own prose. Does not reuse the other verticals'.
  - Blocked by: T-001 · Blocks: T-004, T-020

- [ ] **T-003** (complexity: 2) — Write the experiences publish-page copy (es)
  - Same independence rule as T-002.
  - Blocked by: T-001 · Blocks: T-004, T-021

- [ ] **T-004** (complexity: 1) — Mirror every new key into en and pt
  - AC-16. The guards see structure, never content.
  - Blocked by: T-002, T-003 · Blocks: none

## Core Phase — API

- [ ] **T-005** (complexity: 2) — Add the publish-vertical → limit-key resolver
  - Closed union of three; exhaustive by type, so a fourth is a compile error.
  - Blocked by: none · Blocks: T-006, T-007, T-009

- [ ] **T-006** (complexity: 3) — Count a commerce owner's listings for one vertical
  - Per vertical, never per account (AC-10). Excludes soft-deleted.
  - Blocked by: T-005 · Blocks: T-009

- [ ] **T-007** (complexity: 3) — List a commerce owner's DRAFT listings for one vertical
  - **F-1**: cannot read `/{vertical}/mine` — that projection has no `lifecycleState`.
  - Blocked by: T-005 · Blocks: T-009

- [ ] **T-008** (complexity: 2) — Make the precheck response schema vertical-agnostic
  - Today the draft id is typed `AccommodationIdSchema`.
  - Blocked by: none · Blocks: T-009

- [ ] **T-009** (complexity: 3) — Build the vertical-parameterised precheck route
  - D-7. Reuses `deriveOnboardingDecision` unchanged — it is already pure.
  - Blocked by: T-005, T-006, T-007, T-008 · Blocks: T-010, T-011, T-016

- [ ] **T-010** (complexity: 1) — Register the route and add its endpoint-gate-matrix row
  - A handler without a matrix row fails CI.
  - Blocked by: T-009 · Blocks: none

- [ ] **T-011** (complexity: 3) — Test all six matrix cells across all three verticals
  - Eighteen cases, plus AC-10's crossover.
  - Blocked by: T-009 · Blocks: none

## Core Phase — web lib

- [ ] **T-012** (complexity: 3) — Freeze the accommodation panel's current behaviour in tests
  - **R-2**: it has no covering tests today, and BETA-197 is live in production.
  - Blocked by: none · Blocks: T-013

- [ ] **T-013** (complexity: 3) — Generalise the precheck panel's content resolver
  - **F-2**: changes a contract the JSDoc states deliberately. Rewrite that JSDoc.
  - Blocked by: T-012 · Blocks: T-014

- [ ] **T-014** (complexity: 2) — Make PublishPrecheckPanel.astro take a vertical
  - Assert on rendered output, not on the source string.
  - Blocked by: T-013 · Blocks: T-015, T-017

- [ ] **T-015** (complexity: 3) — Make the delete-draft action vertical-aware
  - AC-14. Today it deletes an accommodation.
  - Blocked by: T-014 · Blocks: none

- [ ] **T-016** (complexity: 1) — Add the web client wrapper for the precheck route
  - Never `fetch()` from a page.
  - Blocked by: T-009 · Blocks: T-017

## Core Phase — pages

- [ ] **T-017** (complexity: 3) — Build the shared form-slot component (three states)
  - Owns the D-5 fail-open. One component, three pages.
  - Blocked by: T-001, T-014, T-016, T-018 · Blocks: T-019, T-020, T-021, T-029

- [ ] **T-018** (complexity: 2) — Build the signed-out signup CTA with a returnUrl
  - D-1. Never a redirect to login — that is what this replaces.
  - Blocked by: T-001 · Blocks: T-017

- [ ] **T-019** (complexity: 3) — Rewrite /publicar/index.astro as the accommodation publish page
  - Absorbs `/publicar/nueva/`; drops the D-3 redirect and its now-redundant fetch.
  - Blocked by: T-017 · Blocks: T-022, T-023, T-024, T-027

- [ ] **T-020** (complexity: 2) — Build /publicar/gastronomia/
  - MarketingLayout, not AccountLayout (D-2).
  - Blocked by: T-002, T-017 · Blocks: T-022, T-023, T-024, T-027

- [ ] **T-021** (complexity: 2) — Build /publicar/experiencias/
  - Same shape as T-020.
  - Blocked by: T-003, T-017 · Blocks: T-022, T-023, T-024, T-027

## Integration Phase

- [ ] **T-022** (complexity: 2) — Repoint PUBLISH_CTA_OPTIONS at the three pages
  - **F-3**: this moves three surfaces, not one. Verify all three.
  - Blocked by: T-019, T-020, T-021 · Blocks: T-028

- [ ] **T-023** (complexity: 3) — Wire the five 301 redirects
  - D-6. Two of them override HOS-941 D-8 — record that in their JSDoc.
  - Blocked by: T-019, T-020, T-021 · Blocks: T-025, T-028

- [ ] **T-024** (complexity: 3) — Repoint every internal link off the superseded URLs
  - AC-18. A link to a redirect is how `4d7e448ea` produced this issue.
  - Blocked by: T-019, T-020, T-021 · Blocks: T-025, T-026

- [ ] **T-025** (complexity: 2) — Retire the superseded page bodies
  - Retiring a page also trips the CSP verifier and the route inventories.
  - Blocked by: T-023, T-024 · Blocks: T-028

## Testing Phase

- [ ] **T-026** (complexity: 3) — Add the static guard against links to superseded URLs
  - Anchor the regexes. Mutation-verify it fails.
  - Blocked by: T-024 · Blocks: none

- [ ] **T-027** (complexity: 2) — Assert the three pages stay out of every cacheable-route list
  - AC-8, R-1. The pages read session.
  - Blocked by: T-019, T-020, T-021 · Blocks: none

- [ ] **T-028** (complexity: 2) — Verify all eight URLs live against a running server
  - Twenty-four curl checks. `astro check` is blind to frontmatter behind an early return.
  - Blocked by: T-022, T-023, T-025 · Blocks: T-030

- [ ] **T-029** (complexity: 3) — Test the form slot's three states
  - Including the fail-open. Mounting a component is not rendering it.
  - Blocked by: T-017 · Blocks: none

## Docs Phase

- [ ] **T-030** (complexity: 2) — Document the publish-page model in apps/web/CLAUDE.md
  - The four rules a future reader would otherwise re-derive wrongly.
  - Blocked by: T-028 · Blocks: none

---

## Dependency graph

```
Level 0: T-001, T-005, T-008, T-012
Level 1: T-002, T-003, T-006, T-007, T-013, T-018
Level 2: T-004, T-009, T-014
Level 3: T-010, T-011, T-015, T-016
Level 4: T-017
Level 5: T-019, T-020, T-021, T-029
Level 6: T-022, T-023, T-024, T-027
Level 7: T-025, T-026
Level 8: T-028
Level 9: T-030
```

T-017 is the single choke point: every page waits on it, and it waits on all
three of the i18n, panel and client tracks. Everything before it can run in
parallel; nothing after it can start early.

## Suggested start

**T-005** (complexity: 2) — it sits at the head of the critical path and
unblocks three tasks. If two people are working, **T-012** is the other
high-value start: it is the safety net for the only change in this spec that
touches a flow already live in production.
