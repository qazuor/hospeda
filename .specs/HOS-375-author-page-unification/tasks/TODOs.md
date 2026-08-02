# HOS-375: Author page — move to `/autores/<slug>/` and unify posts + events

## Progress: 0/36 tasks (0%)

**Average Complexity:** 1.9/3 (max)
**Critical Path:** T-002 → T-003 → T-017 → T-020 → T-021 → T-029 → T-032 (7 steps)
**Parallel Tracks:** 4 identified (db/seed · api · web pages · seo/integration)

> Read [`../spec.md`](../spec.md) before starting anything. Several tasks below exist
> because a claim in the original Linear issue turned out to be false — the spec records
> which, and why.

---

### Setup Phase — 8 tasks (avg complexity 1.9)

- [ ] **T-001** (complexity: 1) — Verify baseline-stamp mechanics for content-only seed data-migrations
  - Research only. Answers whether the baseline half of the dual-write rule applies to T-005/T-006/T-007.
  - Blocked by: none · Blocks: T-005, T-006, T-007

- [ ] **T-002** (complexity: 2) — Add `users.is_system_account` column to the Drizzle schema
  - Blocked by: none · Blocks: T-003, T-005, T-011, T-036

- [ ] **T-003** (complexity: 2) — Add `isSystemAccount` to `UserSchema`
  - Blocked by: T-002 · Blocks: T-004, T-011, T-017

- [ ] **T-004** (complexity: 1) — Set `isSystemAccount: true` in the required user seed fixtures
  - Blocked by: T-003 · Blocks: T-035

- [ ] **T-005** (complexity: 2) — Data-migration: flip `is_system_account` on the two staff accounts
  - Blocked by: T-001, T-002 · Blocks: T-035

- [ ] **T-006** (complexity: 2) — Data-migration: set the editorial account slug to `equipo-hospeda`
  - Resolve by `EDITORIAL_EMAIL`. The current slug differs per environment.
  - Blocked by: T-001 · Blocks: T-007, T-035

- [ ] **T-007** (complexity: 3) — Data-migration: re-attribute imported events to the editorial account
  - Scoped to `created_by_id IS NULL`. Rewrites 44 live production rows.
  - Blocked by: T-001, T-006 · Blocks: T-035

- [ ] **T-008** (complexity: 2) — Add `publicProfileShowSocialNetworks` to the user settings schema
  - Must also be added to the `.strict()` web patch schema or PATCH returns 400.
  - Blocked by: none · Blocks: T-009, T-028

### Core Phase — 14 tasks (avg complexity 2.1)

- [ ] **T-009** (complexity: 1) — Add optional `socialNetworks` to `UserAuthorPublicResponseSchema`
  - Blocked by: T-008 · Blocks: T-010

- [ ] **T-010** (complexity: 2) — Return `socialNetworks` from `getPublicProfileBySlug` only on opt-in
  - Blocked by: T-009 · Blocks: T-020, T-034

- [ ] **T-011** (complexity: 3) — Create the `listPublicAuthors` service
  - Blocked by: T-002, T-003 · Blocks: T-012, T-031

- [ ] **T-012** (complexity: 2) — Add the `GET /api/v1/public/authors` route
  - Mount point is deliberate: `/users/...` would inherit private caching.
  - Blocked by: T-011 · Blocks: T-013, T-027

- [ ] **T-013** (complexity: 1) — Add `/api/v1/public/authors` to `PUBLIC_CACHE_ENDPOINTS`
  - Blocked by: T-012 · Blocks: none

- [ ] **T-014** (complexity: 2) — Add the `author` relation to `EventPublicSchema`
  - Blocked by: none · Blocks: T-015

- [ ] **T-015** (complexity: 3) — Load the author relation on the event detail read path
  - Blocked by: T-014 · Blocks: T-026

- [ ] **T-016** (complexity: 2) — Add `eventsApi.getByAuthor` to the web API client
  - Blocked by: none · Blocks: T-020, T-022

- [ ] **T-017** (complexity: 2) — Create the shared author-indexable predicate helper
  - One predicate shared by page and sitemap, so they can never disagree.
  - Blocked by: T-003 · Blocks: T-020, T-027, T-030, T-031

- [ ] **T-018** (complexity: 2) — Add i18n keys for the author page
  - Blocked by: none · Blocks: T-020

- [ ] **T-019** (complexity: 2) — Create the `ProfilePageJsonLd` component
  - Blocked by: none · Blocks: T-020

- [ ] **T-020** (complexity: 3) — Create the `/autores/[slug]/` page with both content blocks
  - Blocked by: T-010, T-016, T-017, T-018, T-019 · Blocks: T-021, T-022, T-024, T-025, T-026, T-030

- [ ] **T-021** (complexity: 2) — Create the posts pagination page `/autores/[slug]/page/[page]/`
  - Blocked by: T-020 · Blocks: T-029

- [ ] **T-022** (complexity: 2) — Create the events pagination page `/autores/[slug]/eventos/page/[page]/`
  - Exists because the top author has 52 events; a cap would hide 40.
  - Blocked by: T-016, T-020 · Blocks: T-029

### Integration Phase — 7 tasks (avg complexity 1.9)

- [ ] **T-023** (complexity: 2) — Add the 301 redirect from `/publicaciones/autor/*`
  - Blocked by: none · Blocks: T-029, T-033

- [ ] **T-024** (complexity: 1) — Point the post byline components at the new author URL
  - Blocked by: T-020 · Blocks: T-029

- [ ] **T-025** (complexity: 1) — Populate `ArticleJsonLd` `author.url` on the post detail page
  - Blocked by: T-020 · Blocks: none

- [ ] **T-026** (complexity: 2) — Add an author byline linking from the event detail page
  - Blocked by: T-015, T-020 · Blocks: none

- [ ] **T-027** (complexity: 2) — Add author entries to the dynamic sitemap
  - Blocked by: T-012, T-017 · Blocks: T-030

- [ ] **T-028** (complexity: 3) — Add the social opt-in toggle and consent copy to the profile editor
  - Ships with T-008 or the preference is unreachable.
  - Blocked by: T-008 · Blocks: none

- [ ] **T-029** (complexity: 1) — Delete the old author pages under `/publicaciones/autor/`
  - Blocked by: T-021, T-022, T-023, T-024 · Blocks: T-032

### Testing Phase — 6 tasks (avg complexity 2.0)

- [ ] **T-030** (complexity: 2) — Update the facet-noindex CI guard and add conditional indexability tests
  - The existing guard encodes the OLD behavior and goes red when G-3 lands.
  - Blocked by: T-017, T-020, T-027 · Blocks: none

- [ ] **T-031** (complexity: 2) — Add the role-change indexability regression test (AC-16)
  - The test that fails if anyone re-couples the gate to the role.
  - Blocked by: T-011, T-017 · Blocks: none

- [ ] **T-032** (complexity: 2) — Update the tests that reference the old author path
  - Blocked by: T-029 · Blocks: none

- [ ] **T-033** (complexity: 2) — Add redirect tests for tail and query preservation (AC-2)
  - Blocked by: T-023 · Blocks: none

- [ ] **T-034** (complexity: 2) — Add the actor-blind response test for by-slug (AC-6)
  - Blocked by: T-010 · Blocks: none

- [ ] **T-035** (complexity: 2) — Verify fresh-build and migrated-DB parity (AC-15)
  - Blocked by: T-004, T-005, T-006, T-007 · Blocks: none

### Docs Phase — 1 task (avg complexity 1.0)

- [ ] **T-036** (complexity: 1) — Document the `is_system_account` convention
  - Blocked by: T-002 · Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-002, T-008, T-014, T-016, T-018, T-019, T-023
Level 1: T-003, T-005, T-006, T-009, T-015, T-028, T-033, T-036
Level 2: T-004, T-007, T-010, T-011, T-017
Level 3: T-012, T-020, T-031, T-034, T-035
Level 4: T-013, T-021, T-022, T-024, T-025, T-026, T-027
Level 5: T-029, T-030
Level 6: T-032
```

## Ship-order constraint (not expressible as a task dependency)

**G-3 (indexability + sitemap) must not ship before T-005, T-006 and T-007 have run in
production.** Until the attribution work lands, making the page indexable would publish
`/autores/super-admin-user/` — titled "Super Admin", 44 events — into Google. The
dependency graph cannot express "must be deployed before", so this is enforced by review,
not by tooling. See spec §6.10.

## Suggested Start

Begin with **T-001** (complexity: 1) — it has no dependencies and unblocks the entire
seed/data track. It is deliberately a research task: the three data-migrations behind it
touch live production content, and the spec explicitly refuses to guess their mechanics.

**T-002** (complexity: 2) can run in parallel and unblocks the schema/service track.
