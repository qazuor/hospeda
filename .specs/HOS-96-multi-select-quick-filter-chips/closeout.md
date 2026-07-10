# HOS-96 Closeout — Multi-select quick-filter chips

**Status:** Implementation complete (27/27 tasks). Branch
`feat/hos-96-multi-select-quick-filter-chips` off `origin/staging`.

## What shipped

Quick-filter chip rows on the three listing pages (`/alojamientos/`, `/eventos/`,
`/publicaciones/`) are now **multi-select**: clicking a chip accumulates its value in
a CSV array query param (`?types=A,B`, `?categories=A,B`) instead of navigating away
or replacing a single value. Chips, the sidebar, and SEO are all driven from a single
per-facet config, with the URL query param as the only shared state.

### Per-facet config model (T-001)

`apps/web/src/lib/filters/facet-config.ts` (`FACET_CONFIG_BY_ID`) declares each facet's
`paramKey` / `singularParamKey` / `operator` / `enum` / `dedicatedLandingPattern`.
Accommodation `types` is the blueprint; events/blog `categories` replicate it; destinos
`attractions` (AND, client-side) is flagged out of scope and untouched. A new facet
(e.g. HOS-97) is added by declaring an entry here — no chip/sidebar/SEO branch changes.

### Backend `categories` stack (T-002–T-007, pre-session)

`categories` array query param added to `EventSearchHttpSchema` + `PostSearchHttpSchema`
(with enum `.pipe()` validation); manual `inArray`/`eq` precedence branch in `EventModel`

+ `PostModel` (the generic `buildWhereClause` degrades an array to invalid
`eq(col, arrayValue)` — the manual branch is required); `filters.categories` forwarded
through `event.service.ts` / `post.service.ts`.

### Frontend (this session)

+ **T-008** `buildMultiToggleParamHref` — add/remove a value in a CSV param, dedup
  (OQ-4), preserve other params, drop `page`.

+ **T-009** per-chip `active`/`aria-pressed` from the array param; `readFacetActiveValues`
  shared reader; `FilterChips.astro` gains an `ariaPressed` passthrough.

+ **T-010** `buildClearFacetChip` — "Clear (N)" bulk-reset chip (returns `undefined`
  below 2 active), + `common.filterChips.*` i18n (es/en/pt).

+ **T-011/12/13** chip hrefs switched to `buildMultiToggleParamHref`; **each page reads
  its array param and forwards it to the API list call** (`endpoints.ts` `eventsApi/
  postsApi.list` gained `categories`) — the chip href alone does not filter the grid.

+ **T-014/15** sidebar `FilterGroup` id `category`→`categories` (+ the page-side
  `sidebarInitialParams` seed key, or the sidebar silently desyncs).

+ **T-016** `resolveFacetSeoDecision` — the single shared 0/1/2+ SEO predicate.
+ **T-017/18/19** predicate wired into all three listing heads (robots + canonical):
  0 → indexable+base; 1 → indexable+dedicated-landing; 2+ → `noindex,follow`+base.
  Rewrote `facet-noindex.test.ts` and added an M-5 dedicated-landings-unchanged guard.

### Tests (T-020–T-025)

API regression (`?categories=A,B` union), backward-compat (singular still works, array
wins), edge-case matrix (empty/dedup/whitespace/all-selected/invalid), destinos no-op
guard, chip/sidebar/URL sync matrix (3 facets), popstate coherence.

## Resolved OQs (contract)

+ **OQ-1** 2+ values → `noindex,follow` + canonical to base listing. 1 value keeps its
  dedicated-landing canonical.

+ **OQ-2** chips stay `<a>` + `aria-pressed` (not `<button>`).
+ **OQ-3** invalid enum member → strict 400 (events/posts `categories`).
+ **OQ-4** duplicate members de-duplicated — a **frontend** concern
  (`buildMultiToggleParamHref` / `readFacetActiveValues`); the backend does not dedup
  (`IN (A,A)` === `IN (A)`, harmless).

## Owner decision made mid-implementation (2026-07-10)

**Events keeps its dedicated landing as the 1-value canonical.** The spec's config
table wrongly said events had "no dedicated landing", but SPEC-306 already built
`/eventos/categoria/{slug}/` and `/eventos/?category=X` canonicalized to it. Following
the spec literally would have regressed that live SEO behavior. The owner chose to
**preserve** it: `facet-config.ts` `eventCategory.dedicatedLandingPattern` set to
`'/eventos/categoria/{slug}/'`, making all three facets consistent (1 value → dedicated
landing, 2+ → noindex+base). Slug transform verified against the route's own dictionary
for all 9 event + 18 post enum members (encoded as regression tests).

## Flags / follow-ups (out of scope, documented for the owner)

1. **`AccommodationSearchHttpSchema.types` has no enum `.pipe()` validation** (unlike
   events/posts `categories`). So `?types=HOTEL,BOGUS` returns 200 (bogus value matches
   nothing), not a 400 — OQ-3's strict-400 guarantee is facet-specific. Pre-existing,
   out of HOS-96 scope; documented with a test asserting the actual behavior and a note
   in `apps/web/CLAUDE.md`. Consider a follow-up to add the `.pipe()` for parity.

2. **Latent slug fragility**: the predicate's slug transform
   (`toLowerCase().replace(/_/g,'-')`) matches the events/blog category routes only
   because no current enum member contains `_`. A future member like `SPECIAL_EVENTS`
   would break blog's slug (its `POST_CATEGORY_SLUG_MAP` has no hyphen step). Guarded by
   the per-member slug-match regression tests, which would fail loudly.

3. **Popstate coverage is integration-level, not real browser e2e.** No Playwright spec
   covers listing back/forward today. The proof (jsdom History API mechanics + no
   module-scope mutable store + independent sidebar mounts) is strong because the pages
   are SSR/URL-driven (popstate correctness is structural), but a real e2e was not run.
   Optional follow-up if true browser coverage is wanted.

## Pre-merge fresh review (code-reviewer, fresh context)

Full `apps/web` package suite **6335 passed / 0 failed**, typecheck **0 errors** at review
time. Two issues found, both fixed:

1. **Bug** — blog `hasActiveFilters` didn't count the `categories` param, so a
   category-chip-filtered zero-results page showed the "no publications at all" empty
   state with no "clear filters" CTA. Fixed (+ regression test).

2. **Design gap → owner decision (Option A, most robust)** — the new active-value
   signals read only the plural param, so legacy singular links (`?category=X`, `?type=X`)
   lost their dedicated-landing canonical + chip/sidebar highlight (an SEO regression
   contradicting the events-landing owner decision). Fixed with a **singular fallback**:
   `readFacetActiveValues` gains `singularParamKey` (plural wins, else singular, mirroring
   backend precedence); `buildMultiToggleParamHref` gains `singularKey` (seeds from it +
   deletes it on write = migrate singular→plural on first click); `buildClearFacetChip`
   deletes both; the three pages pass the singular key. **Also closed** an adjacent gap the
   fix surfaced: accommodations didn't forward the singular `type` to the API, so a legacy
   `?type=HOTEL` would show the active UI but an unfiltered grid — now forwards `type`
   alongside `types` (backend `types` OR else `type`), matching events/blog.

Owner decided **Option A** (full legacy support) because the prod indexing window is small
and release is imminent — worth doing right the first time.

## Test results

All HOS-96 suites green in isolation (schema, model, service, API route, web
component/page/SEO) plus the review fixes. No production code changed in the testing tasks
(T-020–T-025).

## Smoke gate

Feature is internal (no third-party integration), so no smoke label is required by
default. The SEO `noindex`/canonical changes on live listing pages are the one candidate
for a `status-needs-smoke-staging` live-index verification — owner to decide.
