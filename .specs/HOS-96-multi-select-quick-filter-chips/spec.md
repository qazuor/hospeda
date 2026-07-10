---
title: Multi-select en los chips de filtro rápido de los listados
linear: HOS-96
statusSource: linear
type: feature
areas: [web, api, db, schemas]
created: 2026-07-10
---

# Multi-select en los chips de filtro rápido de los listados

> **Framing note (read first).** This spec does **not** introduce a new UI
> surface. The quick-filter chip row already exists and is already canonical:
> HOS-97 shipped `apps/web/src/components/shared/ui/FilterChips.astro` (an
> href-agnostic, single-canonical chip row) and
> `apps/web/src/lib/filters/toggle-query-param.ts` (a **single-select** in-place
> `?key=value` toggle helper). This spec upgrades the **behavior** of three of
> those chip rows from single-select to **multi-select**, filtering server-side
> with multiple values of the same param. It is a behavioral + backend change
> layered on top of the existing chip component, not a redesign. **Destinos is
> explicitly NOT in scope** — it already does client-side multi-select AND and is
> only documented here as a reference contrast (see "Out of Scope").
>
> The `types` (plural, array) accommodation param **already exists end-to-end**
> (schema + model branch + sidebar). It is the **blueprint** to replicate for
> events and blog `categories`. Do not invent a new pattern; copy the
> accommodation one.

## Part 1: Functional Specification

### Overview & Goals

**Goal.** Let a user select **more than one** quick-filter chip at a time on the
listings that are single-select today — accommodations (by type), events (by
category), and blog/publications (by category) — so the listing filters
server-side by **multiple values of the same query param**, using a combination
operator (`AND`/`OR`) that is **declared per facet**, not hardcoded globally.

**Motivation.**

- **User-facing friction.** Today a user who wants "hoteles O cabañas" can pick
  only one type chip; picking a second replaces the first. Every other
  comparison site lets you widen a listing by ticking several types/categories.
  Destinos already does multi-select, so the product is internally inconsistent.
- **A latent bug is already shipped.** The React sidebar island
  (`FilterSidebar.client.tsx`) for **events and blog** already lets the user tick
  2+ categories and already serializes `?category=A,B`
  (`filter-reducer.ts` `params.set(id, values.join(','))`), but the backend only
  accepts a single `category` enum → `?category=MUSIC,CULTURE` is rejected / does
  not match. So the sidebar visually promises multi-category and silently fails.
  This spec closes that gap (migrate the key to the `categories` array end-to-end).
- **Extensibility.** Gastronomía and experiencias (HOS-97) are single-`type`
  today and are the obvious next facets to gain multi-select. Modeling the
  combination operator as a **per-facet declared property** (not a hardcoded
  `if`) means the sibling issue can add them by declaring config, not by editing
  branching logic.

**Success metrics (all measurable / automatable).**

| # | Metric | How measured |
|---|--------|--------------|
| M-1 | Selecting a 2nd chip **accumulates** (2 values in the URL param), never replaces | Frontend test on the resulting `href`/URL after two clicks |
| M-2 | Backend returns the **OR union** for a multi-value facet (`?types=HOTEL,CABIN` ⇒ rows of either type) | API integration test asserts result set = union, and > single-value result |
| M-3 | `?category=A,B` (the pre-existing latent-bug input) now **matches** for events and blog | Regression integration test that fails on `main` today |
| M-4 | Chip active-state, sidebar checkbox state, and URL param stay in sync with **URL as the single source** | Frontend test: set URL → both chip `aria-pressed` and sidebar checkbox reflect it |
| M-5 | Dedicated single-value landings (`/alojamientos/tipo/{slug}/`, `/publicaciones/categoria/{slug}/`) still resolve and still emit their canonical | Existing landing tests stay green + canonical assertion |
| M-6 | With 2+ values selected, the listing emits the agreed canonical/`noindex` (no combinatorial duplicate URLs indexed) | SEO test on rendered `<head>` for a 2-value URL |
| M-7 | Back/forward (popstate) yields a listing state consistent with the URL at each history entry | Frontend/e2e navigation test |
| M-8 | Destinos behavior is **byte-for-byte unchanged** (still client-side AND inline) | Existing destinos tests stay green; no diff to `destinos/index.astro` filter logic |

**Target users / beneficiaries.**

- **End users** browsing the catalog — can widen a listing by picking several
  types/categories in one gesture, as on any modern travel site.
- **The business** — richer filtering ⇒ users find more relevant results ⇒
  fewer dead-end zero-result pages.
- **Developers** — one declared per-facet operator model + one replicated backend
  pattern, instead of three divergent chip behaviors; the latent
  sidebar-vs-backend bug is closed.

### Existing infrastructure — reuse, do NOT re-implement

Confirmed present in code (2026-07-10). Reuse these; do not rebuild.

| Capability | Location | Notes |
|---|---|---|
| Canonical chip row (href-agnostic) | `apps/web/src/components/shared/ui/FilterChips.astro` | HOS-97; supports optional icon + `showScrollButtons`. Does NOT impose single/multi — caller supplies `href` + `active`. **Extension point for the multi visual state.** |
| Single-select toggle helper | `apps/web/src/lib/filters/toggle-query-param.ts` (`buildToggleParamHref`) | In-place `?key=value` toggle, drops `page`, preserves other params. **Single-select only** (documented as such). Needs a multi-value sibling. |
| Accommodation `types` array param (BLUEPRINT) | `packages/schemas/.../accommodation.http.schema.ts` `types: createArrayQueryParam(...)` (single `type` also kept) | Already end-to-end. |
| Accommodation model array branch (BLUEPRINT) | `packages/db/src/models/accommodation/accommodation.model.ts` `if (params.types?.length) inArray(accommodations.type, params.types) else if (params.type) eq(...)` | Replicate this exact precedence for events/posts. |
| CSV/repeated array param helper | `packages/schemas/src/api/http/base-http.schema.ts` `createArrayQueryParam` | Splits on `,`, trims, filters empties; accepts `?k=a,b` or repeated `?k=a&k=b`; `.optional()`. |
| Accommodation "active filter chips" (removable) | `apps/web/src/pages/[lang]/alojamientos/index.astro` (~L520-525) | Removable-chip pattern to reuse for the "Clear (N)" affordance. |
| Filter-facet canonical resolver | `apps/web/src/lib/seo/promoted-facet-canonical.ts` (`resolvePromotedFacetCanonical`) | Drives single-value landing canonical. Extend for 2+ values (SEO story). |
| React sidebar island | `apps/web/src/components/shared/filters/FilterSidebar.client.tsx` + `filter-reducer.ts` | Shares state with chips **only via URL query params**. Serializes selections as CSV already. |
| Destinos multi-select (REFERENCE, do NOT touch) | `apps/web/src/pages/[lang]/destinos/index.astro` | Client-side AND, inline, `?attractions=a,b`, `showFilters=false`, full dataset in SSR. Documented as out of scope. |

### The per-facet configuration model (product contract)

Each multi-selectable facet declares its behavior. This is a **product contract**
(owner-decided) and must be modeled as declared config, extensible to future
facets, never a hardcoded global operator.

| Facet | `paramKey` (array) | `singularParamKey` (kept) | `operator` | Enum | Dedicated single-value landing |
|---|---|---|---|---|---|
| Accommodation type | `types` | `type` | **OR** | `AccommodationTypeEnum` | `/alojamientos/tipo/{slug}/` (canonical entry for ONE value) |
| Event category | `categories` (**NEW**) | `category` | **OR** | `EventCategoryEnum` | none today (chips toggle in-place already) |
| Blog/post category | `categories` (**NEW**) | `category` | **OR** | `PostCategoryEnum` | `/publicaciones/categoria/{slug}/` (canonical entry for ONE value) |
| Destination attraction | `attractions` | — | **AND** | attraction ids | client-side inline — **UNCHANGED, out of scope** |

Rules the config must encode:

1. **`operator`** — `'AND' | 'OR'`. Destinos = `AND` (preserved, client-side).
   Accommodation type / event category / blog category = `OR`. The value drives
   backend combination (`inArray` = OR union; AND is destinos-only client-side and
   not a backend concern). Modeled so gastronomía/experiencias (HOS-97 sibling)
   can be added by declaring config, not editing logic.
2. **`paramKey`** (plural, array) is the multi-select source of truth in the URL.
3. **`singularParamKey`** (existing scalar param) stays **accepted for backward
   compatibility** (old links, dedicated landings that pass one value). When both
   are present, the array takes precedence (mirrors the accommodation model's
   `if types else if type`).

### User Stories & Acceptance Criteria

> **Reading convention.** "the listing" = the base listing page
> (`/alojamientos/`, `/eventos/`, `/publicaciones/`). "the chip row" = the
> `FilterChips` row above the grid. "the sidebar" = the `FilterSidebar` React
> island. All three read/write the **same URL query param** — the URL is the ONLY
> shared state (no in-memory shared store). Every criterion below is written to be
> a single automatable test.

---

#### US-1: Selecting a second chip accumulates instead of replacing (P0)

**As a** user browsing a listing, **I want** clicking a second type/category chip
to add it to my active filter, **so that** I can widen my results to several
types at once instead of the second click replacing the first.

Context: today `buildToggleParamHref` is single-select — a second click `set`s the
param to the new single value, discarding the old. This story introduces a
multi-value toggle that accumulates.

**Acceptance Criteria:**

- **Given** an accommodation listing with no type filter, **When** the user clicks
  the "Hotel" chip, **Then** the resulting URL contains `?types=HOTEL` and the grid
  shows hotels.
- **Given** the URL already has `?types=HOTEL`, **When** the user clicks the
  "Cabaña" chip, **Then** the resulting URL contains **both** values
  (`?types=HOTEL,CABIN`), not `?types=CABIN` — the second value is **appended**.
- **Given** `?types=HOTEL,CABIN`, **When** the multi-toggle href for a third value
  "Departamento" is built, **Then** it produces `?types=HOTEL,CABIN,APARTMENT`
  preserving order and every other param (`q`, `destinationIds`, `sortBy`).
- **Given** any chip click, **When** the href is built, **Then** `page` is dropped
  (pagination resets to page 1) — same guarantee as the single-select helper.
- **Given** a facet whose `operator` is `OR`, **When** two values are active,
  **Then** the values are combined into ONE array param (`?types=A,B`), never two
  different param keys.

---

#### US-2: Multiple values return the OR union server-side (P0)

**As a** user with several type chips active, **I want** the results to include
items matching **any** of my selected types, **so that** widening the filter
actually shows more results, not fewer.

Context: backend filters via `inArray(column, values)` = SQL `IN (...)` = OR union.
This is the accommodation model blueprint; events/posts must replicate it.

**Acceptance Criteria:**

- **Given** the API request `GET /api/v1/public/accommodations?types=HOTEL,CABIN`,
  **When** it is served, **Then** the response contains rows whose `type` is
  `HOTEL` **or** `CABIN`, and none of any other type.
- **Given** the same request, **When** its result count is compared to
  `?types=HOTEL` alone, **Then** the multi-value count is **greater than or equal
  to** the single-value count (union never shrinks the set).
- **Given** `GET /api/v1/public/events?categories=MUSIC,CULTURE`, **When** it is
  served, **Then** it returns events whose `category` is `MUSIC` **or** `CULTURE`
  (this endpoint does NOT accept `categories` on `main` — see US-9).
- **Given** `GET /api/v1/public/posts?categories=A,B`, **When** it is served,
  **Then** it returns posts whose `category` is `A` **or** `B`.
- **Given** a multi-value request where the underlying model resolves the array,
  **When** the query is built, **Then** it uses `inArray(column, values)`
  (indexed-column `IN`), NOT a plain `eq(column, arrayValue)` which produces
  invalid SQL (the exact reason events/posts need a manual model branch — see
  Architecture).

---

#### US-3: Deselecting one chip removes only that value (P0)

**As a** user with several chips active, **I want** clicking an active chip to
remove just that one value, **so that** I can narrow my filter without clearing
everything.

**Acceptance Criteria:**

- **Given** `?types=HOTEL,CABIN,APARTMENT`, **When** the user clicks the active
  "Cabaña" chip, **Then** the resulting URL is `?types=HOTEL,APARTMENT` (only
  `CABIN` removed, order of the rest preserved).
- **Given** `?types=HOTEL` (single active value), **When** the user clicks the
  active "Hotel" chip, **Then** the `types` param is **removed entirely** and the
  URL returns to the unfiltered base (no empty `?types=` param left behind).
- **Given** a value that is not currently active, **When** its chip is clicked,
  **Then** it is added (US-1), not removed — the toggle is per-value, not global.
- **Given** any deselection, **When** the href is built, **Then** all other params
  (`q`, `sortBy`, other facets) are preserved and `page` is dropped.

---

#### US-4: A "Clear (N)" affordance resets the whole facet (P0)

**As a** user with 2+ chips active in one facet, **I want** a single "Clear (N)"
control, **so that** I can reset that facet in one click instead of deselecting
each chip.

**Acceptance Criteria:**

- **Given** a facet with 2+ active values (`?types=HOTEL,CABIN`), **When** the chip
  row renders, **Then** a "Limpiar (2)" chip appears showing the count `N` of
  active values in that facet.
- **Given** fewer than 2 active values (0 or 1), **When** the chip row renders,
  **Then** the "Limpiar (N)" chip is **absent** (a single active value is cleared
  by clicking that active chip per US-3; the bulk control only appears at 2+).
- **Given** the "Limpiar (N)" chip, **When** the user activates it, **Then** the
  facet's array param is removed entirely from the URL while every **other**
  facet/param is preserved, and `page` is dropped.
- **Given** the "Limpiar (N)" chip, **When** rendered, **Then** it reuses the
  removable "active filter chip" pattern that accommodations already has (visual
  and interaction parity, not a new bespoke control).

---

#### US-5: Chip, sidebar, and URL stay in sync via the URL param (P0)

**As a** user, **I want** the chip row and the sidebar checkboxes to always agree
about what is selected, **so that** the interface never lies about my active
filters regardless of where I toggled them.

Context: the ONLY shared state between chips and sidebar is the URL query param.
There is no in-memory shared store. Both derive their state from the same
`paramKey`. The sidebar's `filter-reducer` already serializes selections as CSV;
this story aligns the **key** (`category` → `categories`) so the same array param
feeds both.

**Acceptance Criteria:**

- **Given** the URL `?types=HOTEL,CABIN`, **When** the page renders, **Then** the
  "Hotel" and "Cabaña" chips both render active (`aria-pressed="true"`) AND the
  matching sidebar checkboxes both render checked.
- **Given** the user checks a third box in the sidebar, **When** the sidebar
  navigation fires (debounced), **Then** the URL param gains that value AND, on the
  re-rendered page, the corresponding chip is active — both derived from the same
  URL.
- **Given** the events/blog sidebar, **When** it serializes multiple selected
  categories, **Then** it writes them under the **`categories`** key (the array
  param the backend now accepts), NOT the old `category` singular key that the
  backend rejects for multiple values (closes the latent bug — see US-9).
- **Given** no in-memory shared store is introduced, **When** state is inspected,
  **Then** the single source of truth for active values remains the URL query
  param (assertable: navigating to a crafted URL alone reproduces the exact
  selected state in both chip row and sidebar).

---

#### US-6: The dedicated single-value landing stays alive and canonical (P0)

**As a** search engine and as a user following a shared link, **I want** the
dedicated per-value landings (`/alojamientos/tipo/{slug}/`,
`/publicaciones/categoria/{slug}/`) to keep working and keep their canonical URL,
**so that** SEO equity and existing links are not broken by the move to in-place
toggling.

Context: accommodation-type and blog-category chips historically navigated to a
dedicated route. This spec moves the **chip interaction** to in-place param
toggling (like events already do), but the dedicated landings must **remain** as
the canonical entry point for exactly ONE value.

**Acceptance Criteria:**

- **Given** `/alojamientos/tipo/hotel/`, **When** it is requested, **Then** it
  still resolves (200) and still emits its existing canonical via
  `resolvePromotedFacetCanonical` — unchanged from today.
- **Given** `/publicaciones/categoria/{slug}/`, **When** it is requested, **Then**
  it still resolves and still emits its canonical — unchanged.
- **Given** the base listing with exactly ONE value selected
  (`/alojamientos/?types=HOTEL`), **When** its `<head>` renders, **Then** its
  canonical points at the dedicated single-value landing
  (`/alojamientos/tipo/hotel/`) so the single-value listing and its landing do not
  compete as duplicates (existing `resolvePromotedFacetCanonical` behavior,
  preserved).
- **Given** a chip is clicked while on a dedicated landing that adds a **second**
  value, **When** the href is built, **Then** it navigates to the **base listing**
  with the multi-value param (`/alojamientos/?types=HOTEL,CABIN`), because a
  landing is single-value by definition.

---

#### US-7: With 2+ values selected, avoid indexable combinatorial duplicates (P0)

**As a** search engine, **I want** multi-value filter combinations to NOT create a
combinatorial explosion of indexable near-duplicate URLs, **so that** crawl budget
and ranking are not diluted by `?types=A,B`, `?types=A,C`, `?types=B,C`, … pages.

**Product decision (proposed, owner to confirm in OQ-1):** when **2 or more**
values are selected in a facet, the base listing emits `robots: noindex,follow`
**and** its canonical points at the **base listing with no facet params**. One
value keeps its dedicated-landing canonical (US-6); zero values is the plain
indexable base listing. Rationale: the union of two facet values has no unique
search intent worth a distinct indexed URL, and `follow` preserves link equity
flow to the individual indexable landings. This mirrors how `/busqueda/` is
already `noindex`.

**Acceptance Criteria:**

- **Given** a base listing with 2+ values in a facet
  (`/alojamientos/?types=HOTEL,CABIN`), **When** its `<head>` renders, **Then** it
  emits `<meta name="robots" content="noindex,follow">`.
- **Given** the same 2+-value URL, **When** its canonical renders, **Then** the
  canonical href is the **base listing without facet params** (e.g.
  `/alojamientos/`), not any `?types=` combination.
- **Given** exactly ONE value, **When** the head renders, **Then** it is
  **indexable** and its canonical is the dedicated landing (US-6) — the 2+ rule
  does NOT fire at one value.
- **Given** zero values (plain base listing), **When** the head renders, **Then**
  it is indexable with the base-listing canonical — unchanged.
- **Given** the `noindex`/canonical decision, **When** implemented, **Then** the
  "2+ values" predicate is defined in ONE shared helper used by every affected
  listing (no per-page divergence).

---

#### US-8: Back/forward navigation stays coherent with the URL (P1)

**As a** user, **I want** the browser back and forward buttons to restore the
exact filter state I had at each step, **so that** history navigation behaves
predictably with multi-select filters.

Context: the frontend keeps the existing full-reload/pagination + View Transitions
model (server-side filtering, NOT inline like destinos). Each filter change is a
real navigation, so each is a distinct history entry.

**Acceptance Criteria:**

- **Given** the user applied `?types=HOTEL`, then `?types=HOTEL,CABIN`, **When**
  they press Back, **Then** the listing shows the `?types=HOTEL` state (chips,
  sidebar, and grid all reflect one value) — because the state is fully derived
  from the restored URL.
- **Given** they then press Forward, **When** the page restores, **Then** the
  `?types=HOTEL,CABIN` state returns identically (both chips active, grid = union).
- **Given** a popstate navigation to any prior facet URL, **When** the page
  renders, **Then** no stale in-memory selection survives that contradicts the URL
  (URL is the single source — US-5).

---

#### US-9: Events and blog accept a `categories` array (closes latent bug) (P0)

**As a** user who ticks two categories in the events or blog sidebar, **I want**
the results to actually filter by both, **so that** the multi-category UI the
sidebar already shows stops silently failing.

Context (the bug): `FilterSidebar` already lets the user tick 2+ categories and
`filter-reducer` already serializes `?category=A,B`, but `EventSearchHttpSchema` /
`PostSearchHttpSchema` only accept a single `category` enum, and neither
`EventModel` nor `PostModel` has a manual category `WHERE` — they go through the
generic `buildWhereClause`, which does NOT convert an array into `inArray` (it
falls through to `eq(column, arrayValue)` = invalid SQL). So `?category=MUSIC,CULTURE`
is rejected or returns nothing. This story adds the `categories` array across all
three layers.

**Acceptance Criteria:**

- **Given** `EventSearchHttpSchema` / `PostSearchHttpSchema`, **When** extended,
  **Then** each gains `categories: createArrayQueryParam('...')` **in addition to**
  the retained singular `category` enum.
- **Given** `EventModel` / `PostModel`, **When** they build their `WHERE`, **Then**
  each has a manual branch mirroring `AccommodationModel`:
  `if (params.categories?.length) inArray(column, params.categories) else if
  (params.category) eq(column, params.category)`.
- **Given** the event/post **services** (`event.service.ts` / `post.service.ts`),
  **When** they map HTTP params to model filters, **Then** they pass
  `filters.categories` through to the model (the public list routes pass
  `httpParams` straight to the service).
- **Given** the migrated system, **When** the sidebar serializes multiple selected
  categories, **Then** it writes them under the `categories` key so the whole chain
  (sidebar → URL → HTTP schema → model → SQL) is aligned.
- **Given** the request `?category=MUSIC,CULTURE` that fails on `main` today,
  **When** the migration is complete, **Then** the equivalent `categories`-keyed
  request matches both categories (regression test that is red on `main`, green
  after).

---

#### US-10: Backward compatibility — singular params still accepted (P1)

**As** an existing shared link or a dedicated landing passing one value, **I want**
the old singular `?type=`/`?category=` param to keep working, **so that** the
migration does not break bookmarks, external links, or the landings.

**Acceptance Criteria:**

- **Given** `GET /api/v1/public/accommodations?type=HOTEL` (singular), **When**
  served, **Then** it still returns hotels (existing single branch preserved).
- **Given** `GET /api/v1/public/events?category=MUSIC` (singular), **When** served,
  **Then** it returns music events — the new `categories` array does NOT remove the
  singular enum.
- **Given** a request that sends **both** `type=HOTEL` and `types=CABIN,APARTMENT`,
  **When** served, **Then** the **array takes precedence** (returns cabins +
  apartments), matching the `if (types) … else if (type)` precedence in the model.
- **Given** a dedicated landing (`/alojamientos/tipo/hotel/`) that internally
  resolves one value, **When** it queries, **Then** it still works via the singular
  path (no landing rewrite required).

---

#### US-11: Invalid or empty facet values fail safe (P1)

**As** the API, **I want** malformed multi-value params to be rejected or ignored
cleanly, **so that** a crafted URL cannot break the listing or leak an error.

**Acceptance Criteria:**

- **Given** `?types=HOTEL,NOT_A_TYPE`, **When** Zod validates against the enum-typed
  array, **Then** the request is rejected with a 400 (invalid enum member) — the
  same strictness the singular enum already applies. (If OQ-3 decides lenient
  drop-invalid instead, the criterion flips to "invalid members are dropped, valid
  ones filter" — owner decides; default = strict 400.)
- **Given** `?types=` (empty), **When** parsed by `createArrayQueryParam`, **Then**
  it resolves to `undefined` (empty string → no values) and the listing is
  unfiltered — no `inArray([])` producing an empty-set SQL bug.
- **Given** `?types=HOTEL,HOTEL` (duplicate), **When** parsed, **Then** the result
  is well-defined (either de-duplicated or harmlessly `IN (HOTEL, HOTEL)`); assert
  the chosen behavior explicitly so it is not left to interpretation.
- **Given** a whitespace/CSV mix (`?types= HOTEL , CABIN`), **When** parsed by
  `createArrayQueryParam` (trims + filters empties), **Then** it yields
  `['HOTEL','CABIN']`.

---

#### US-12: Destinos is unchanged (regression guard) (P0)

**As** the platform, **I want** the destinos listing to keep its current
client-side AND multi-select behavior untouched, **so that** this spec does not
regress the one listing that already works differently by design.

**Acceptance Criteria:**

- **Given** `apps/web/src/pages/[lang]/destinos/index.astro`, **When** this spec is
  implemented, **Then** its filter logic (`activeIds` Set from `?attractions=a,b`,
  `cardMatchesFilter()` AND, the `is:inline` reconcile + `startViewTransition`
  script, `showFilters=false`, full-dataset SSR) has **no functional diff**.
- **Given** the destinos existing tests, **When** the suite runs, **Then** they
  stay green with no modification.
- **Given** the per-facet config model, **When** destinos is represented in it,
  **Then** it is marked `operator: AND` and flagged client-side-only /
  out-of-backend-scope — documented, not re-implemented.

### UX Considerations

- **Multi active visual state.** Each active chip renders in the active treatment
  and carries `aria-pressed="true"`. Multiple chips can be active simultaneously
  (the whole point). Inactive chips carry `aria-pressed="false"`. Because a chip
  now toggles rather than navigates to a distinct page, `aria-pressed` (a toggle
  affordance) is the correct semantic — note this is a change from a plain link
  chip; see OQ-2 on whether these remain `<a>` anchors or become `<button>`s.
- **"Clear (N)" affordance.** Appears only at 2+ active values in a facet, shows
  the live count, reuses the removable active-filter-chip pattern accommodations
  already has. At 0-1 values it is absent (single value cleared by re-clicking it).
- **Loading / View Transitions.** Each toggle is a real navigation (server-side
  filtering), preserving the existing full-reload + pagination + View Transitions
  model — NOT destinos' inline client reconcile. Users get the existing transition
  animation between filter states.
- **Scroll of chips.** The existing horizontal scroll + mobile edge-fade +
  optional desktop `showScrollButtons` arrows (`FilterChips`) are unchanged; the
  "Clear (N)" chip participates in the same scrollable row.
- **Accessibility.**
  - Active state exposed via `aria-pressed`, not color alone.
  - Keyboard: every chip is reachable and operable by keyboard (Enter/Space per
    its element type — resolve `<a>` vs `<button>` in OQ-2 so the key handling is
    unambiguous).
  - The chip row keeps its accessible `<nav>` label; the "Clear (N)" control has an
    accessible name including the count (e.g. `aria-label="Limpiar 2 filtros de
    tipo"`).
  - `prefers-reduced-motion` respected by the existing View Transition handling.
- **Edge cases.** All values in a facet selected → union == unfiltered result set
  (acceptable; "Clear (N)" still resets). Selecting a value then removing it
  returns to the exact prior URL/state. A user landing on a crafted 3-value URL
  sees all three chips active and the union grid, with `noindex` in `<head>`.
- **Error states.** Invalid enum member in the array → 400 from the API; the web
  page renders its existing listing-error state (`{hasError && ...}` block) rather
  than a blank grid. Empty `?types=` → treated as unfiltered, never an error.

### Out of Scope

- **Destinos** (`/destinos/`). Already does client-side multi-select **AND**
  inline (no backend), by design (whole dataset in SSR, `showFilters=false`). It is
  documented as the `AND` reference in the facet-config model and is **explicitly
  not modified** (US-12 guards this).
- **Gastronomía and experiencias** multi-select. They are single-`type` today
  (HOS-97). Extending them to multi-select is the **sibling issue's** job; this
  spec only makes the operator model extensible so they can be added by declaring
  config. Not implemented here.
- **Visual redesign of the chips.** BETA-113 already unified the chip visual
  style and HOS-97 delivered the canonical `FilterChips` component. This spec adds
  **behavior** (multi state + "Clear (N)"), not a restyle.
- **`AccommodationTypeBadge` interactive variant on the home page** (the
  "destacados" row). Out of functional scope; only mentioned so it is not
  accidentally swept into the migration.
- **New facets / new filter capability** beyond the three listed. No new enum, no
  "tipo de cocina", nothing that does not already have a column to filter on.
- **Any data-model change.** No table, column, index, enum, or migration — see
  Data Model Changes.

## Part 2: Technical Analysis

### Architecture

- **Pattern.** Config-driven per-facet behavior (declared operator + param keys),
  server-side array filtering via `inArray` (OR union), progressive URL-as-state
  (chips + sidebar both derive from the URL query param — no shared in-memory
  store), and a single shared SEO predicate for the 2+-value `noindex`/canonical
  rule.
- **The accommodation `types` path is the blueprint.** It is already complete
  end-to-end. Events and blog must be brought to parity by replicating it exactly:
  HTTP schema array param → manual model branch with array-over-singular
  precedence → service pass-through.
- **Layer-by-layer flow (events/blog `categories`, the net-new work):**
  1. **Schema** (`@repo/schemas`): add
     `categories: createArrayQueryParam('Filter by multiple categories')` to
     `EventSearchHttpSchema` and `PostSearchHttpSchema`, keeping the singular
     `category` enum. This is the source of truth for the API types.
  2. **Model** (`@repo/db`): add a manual `WHERE` branch to `EventModel` and
     `PostModel` mirroring `AccommodationModel`:
     `if (params.categories?.length) whereClauses.push(inArray(events.category, params.categories))`
     `else if (params.category) whereClauses.push(eq(events.category, params.category))`.
     This is required because the generic `buildWhereClause` does NOT convert an
     array to `inArray` — it falls through to `eq(column, arrayValue)` (invalid).
  3. **Service** (`@repo/service-core`): `event.service.ts` / `post.service.ts`
     forward `filters.categories` to the model (public list routes pass HTTP params
     straight through).
  4. **Frontend helper** (`apps/web`): add a **multi-value** sibling to
     `buildToggleParamHref` (e.g. `buildMultiToggleParamHref`) that accumulates /
     removes a value inside a CSV array param, preserving other params and dropping
     `page`. The chip rows use it; each chip computes `active = values.includes(v)`.
  5. **Chip row** (`FilterChips`): the caller passes `active` per chip and renders
     `aria-pressed`; the row gains support for the "Clear (N)" chip (a chip whose
     href removes the whole facet param). Component stays href-agnostic.
  6. **Sidebar key alignment**: the events/blog sidebar `FilterGroup` id changes
     from `category` to `categories` so `filter-reducer`'s existing CSV
     serialization writes the array param the backend now accepts.
  7. **SEO**: extend `resolvePromotedFacetCanonical` (or a sibling helper) with the
     2+-value rule (canonical → base listing, emit `noindex,follow`); one shared
     predicate consumed by every affected listing page.
- **Accommodation type** needs no schema/model change (`types` already exists);
  its work is frontend-only: switch the chip from dedicated-route navigation to the
  in-place multi-toggle, add active state + "Clear (N)", keep the dedicated landing
  as the single-value canonical entry.
- **Conventions.** English-only code/comments/identifiers; RO-RO for the new
  helper; Zod for the new params; named exports; `import type`; ≤500 lines/file.
  Astro components use a `readonly` `Props` interface. Follow web styling rules
  (vanilla CSS / CSS Modules, `@repo/icons`, `@repo/i18n`, no Tailwind).

### Data Model Changes

| Table/Schema | Change | Description |
|---|---|---|
| — | **none** | No table, column, index, FK, or enum change. |

**Migrations needed:** **NO.** This feature filters exclusively by **existing
columns** — `accommodations.type`, `events.category`, `posts.category` — using
`inArray` over values of the **existing enums**. The only "schema" edits are to the
**Zod HTTP schemas** in `@repo/schemas` (adding array query params), which are
type/validation definitions, not database migrations. None of the three migration
carriles (structural / extras / seed data) is triggered. State this explicitly to
the implementer: **if you find yourself writing a Drizzle migration, you are doing
something wrong.**

### API Design

Two existing public list endpoints gain an array param; the accommodation one
already has it.

#### GET /api/v1/public/accommodations  (already supports `types`)

- **Auth:** none (public tier).
- **Request (relevant params):** `type` (enum, singular — kept) and `types`
  (`createArrayQueryParam`, CSV or repeated — already present). No change.
- **Response:** existing paginated accommodation list shape.
- **Behavior:** `types` present ⇒ `inArray(accommodations.type, types)`; else
  `type` ⇒ `eq`. (Already implemented — the blueprint.)

#### GET /api/v1/public/events  (add `categories`)

- **Auth:** none (public tier).
- **Request:** add `categories` (`createArrayQueryParam`, CSV `?categories=A,B` or
  repeated `?categories=A&categories=B`); keep singular `category` enum.
- **Response:** existing paginated event list shape (unchanged).
- **Behavior:** `categories?.length` ⇒ `inArray(events.category, categories)`;
  else `category` ⇒ `eq(events.category, category)`.
- **Errors:** `400` when any array member is not a valid `EventCategoryEnum` value
  (Zod), same strictness as the singular enum (see OQ-3 for strict-vs-lenient).

Request example:

```http
GET /api/v1/public/events?categories=MUSIC,CULTURE&sortBy=startDate&page=1
```

Behavior: returns events whose `category ∈ {MUSIC, CULTURE}`, union, paginated.

#### GET /api/v1/public/posts  (add `categories`)

- **Auth:** none (public tier).
- **Request:** add `categories` (`createArrayQueryParam`); keep singular `category`.
- **Response:** existing paginated post list shape (unchanged).
- **Behavior:** `categories?.length` ⇒ `inArray(posts.category, categories)`; else
  `category` ⇒ `eq`.
- **Errors:** `400` on invalid enum member (Zod), per OQ-3.

**Backward compatibility (all three endpoints):** the singular param (`type` /
`category`) remains accepted and behaves exactly as today. When both singular and
array are present, the **array wins** (mirrors the accommodation model precedence).
Empty array param (`?categories=`) ⇒ `undefined` ⇒ unfiltered (no `inArray([])`).

### Dependencies

**External packages:** none new.

**Internal packages affected:**

- `@repo/schemas` — add `categories` array param to event + post HTTP schemas
  (source of truth for the new types).
- `@repo/db` — add manual `categories` `WHERE` branch to `EventModel` + `PostModel`
  (accommodation model already done).
- `@repo/service-core` — forward `filters.categories` in `event.service.ts` /
  `post.service.ts`.
- `apps/api` — no route change (public list routes pass HTTP params through); only
  benefits from the schema/model/service changes.
- `apps/web` — new multi-toggle helper, chip active state + "Clear (N)", sidebar
  key alignment (`category`→`categories`), accommodation chip switch to in-place
  toggle, 2+-value canonical/`noindex` SEO rule.
- `@repo/i18n` — label for the "Clear (N)" control (new string).

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Combinatorial `?types=A,B` URLs get indexed as near-duplicates | M | H | 2+-value ⇒ `noindex,follow` + canonical → base listing, via ONE shared predicate (US-7); one-value keeps dedicated-landing canonical |
| Existing links / dedicated landings break | M | H | Keep singular params accepted (US-10) + keep dedicated landings resolving & canonical (US-6); array-over-singular precedence |
| Sidebar key `category`→`categories` desyncs chip and sidebar | M | M | URL is the single shared source; both read the same array key; assert sync in tests (US-5); do the key rename atomically across sidebar + schema + model |
| `eq(column, arrayValue)` slips through the generic `buildWhereClause` for events/posts (invalid SQL / silent no-match) | H | H | Mandatory manual model branch with `inArray` (US-2, US-9); regression test on the exact `?category=A,B` bug input |
| Query cost grows with many OR values | L | M | `inArray` is `IN (...)` over an **indexed** enum column; pagination unchanged; realistically ≤ enum cardinality (≤14) |
| Accommodation chip switch from route-nav to in-place toggle changes SEO entry | M | M | Preserve dedicated landing as one-value canonical (US-6); only chip interaction changes, not the landing |
| Empty/duplicate/invalid array members cause bad SQL or 500s | M | M | `createArrayQueryParam` trims/filters empties → `undefined`; Zod enum validates members; define dup behavior explicitly (US-11) |

### Performance Considerations

- **Expected load.** Same traffic; these are filter refinements on existing list
  endpoints, not new endpoints.
- **Query shape.** Multi-value filtering is a single `WHERE column IN (v1,…,vn)`
  over an **indexed enum column** — no join, no N+1. `n` is bounded by enum
  cardinality (accommodation ≤ its type count, event/post ≤ their category counts),
  so the `IN` list is tiny.
- **Pagination intact.** The `IN` clause composes with the existing `LIMIT/OFFSET`
  pagination; no change to page sizing or count queries beyond the added predicate.
- **Frontend.** No extra client JS beyond the existing chip scroll script; each
  toggle is a normal navigation (already the model), so no new hydration cost. The
  destinos inline-reconcile path is NOT introduced here.
- **Monitoring.** No new metric required; existing list-endpoint latency dashboards
  cover it.

## Testing Strategy

Tests are mandatory (project rule: no tests = not done). AAA pattern. Every
acceptance criterion above is written to map to at least one test. Layer coverage:

**Unit — schemas (`@repo/schemas`):**

- `createArrayQueryParam` parses CSV `?k=a,b` → `['a','b']`; repeated `?k=a&k=b`;
  trims whitespace; filters empties; empty string → `undefined`.
- `EventSearchHttpSchema` / `PostSearchHttpSchema` accept `categories` array of
  valid enum members; reject an invalid member with a Zod error (400 basis);
  accept singular `category` alone; accept both (array present).

**Unit — frontend helper (`apps/web`):**

- New `buildMultiToggleParamHref`: adding a value to an empty param
  (`→ ?k=a`); appending a second (`?k=a → ?k=a,b`); removing a middle value
  (`?k=a,b,c → ?k=a,c`); removing the last value drops the param entirely;
  preserves other params (`q`, `sortBy`, other facets); always drops `page`.
- "Clear (N)" href removes the whole facet param, preserves everything else.

**Unit — model (`@repo/db`):**

- `EventModel` / `PostModel` build `inArray(column, values)` when `categories` has
  1 value, N values; fall back to `eq` when only singular `category`; array takes
  precedence when both present; `categories` empty/undefined ⇒ no category clause.
- Assert the produced SQL uses `IN`, not `= $array` (guards the latent bug).

**Integration — service (`@repo/service-core`):**

- `event.service.ts` / `post.service.ts` pass `filters.categories` through to the
  model; result set is the union for multi-value input.

**Integration — API (`apps/api`):**

- `GET /events?categories=A,B` → union of A and B; `count >= single-value count`.
- `GET /posts?categories=A,B` → union.
- Invalid member (`?categories=A,NOPE`) → `400` (or lenient per OQ-3 — pin the
  chosen behavior).
- Backward compat: `?category=A` (singular) still matches.
- Both present (`?category=A&categories=B,C`) → array wins.
- Empty (`?categories=`) → unfiltered, not an error, not `IN ()`.
- **Regression (the shipped bug):** the exact `?category=A,B`-equivalent input that
  returns nothing on `main` now (as `categories=A,B`) matches both — a test that is
  RED on `main`, GREEN after.

**Frontend / component (`apps/web`):**

- Clicking a second chip accumulates (URL gains 2nd value, not replace) — US-1.
- Clicking an active chip removes only that value; removing the last clears the
  param — US-3.
- "Clear (N)" appears at 2+ values, absent at 0-1, resets the facet — US-4.
- Given a crafted multi-value URL, chip `aria-pressed` states AND sidebar
  checkboxes both reflect it — US-5 (URL as single source).
- Sidebar serializes multiple categories under `categories` key — US-5/US-9.
- popstate back/forward restores the exact per-URL state — US-8.

**SEO tests (`apps/web`):**

- 2+-value listing `<head>` emits `noindex,follow` and canonical → base listing
  (no `?`) — US-7.
- 1-value listing is indexable, canonical → dedicated landing — US-6/US-7.
- 0-value listing indexable, base-listing canonical — US-7.
- Dedicated landings (`/alojamientos/tipo/hotel/`,
  `/publicaciones/categoria/{slug}/`) still resolve and emit their canonical — US-6.

**Regression / no-op guards:**

- Destinos filter logic + tests unchanged (no functional diff) — US-12.
- Accommodation singular `?type=` path still works — US-10.

**Explicit edge cases to cover:** empty array param; duplicate members
(`?types=A,A` — pin de-dup vs `IN (A,A)`); all-values-selected (union ==
unfiltered); whitespace CSV (` A , B `); invalid member; array+singular both
present; last-value removal clears param; 2+-value SEO head.

## Implementation Approach

> Ordered so the backend contract lands first (unblocks everything), then the
> frontend behavior, then SEO, then tests + docs. Each phase is a natural pause
> point. Accommodation type is mostly frontend (its backend already exists);
> events/blog need the full stack.

### Phase 1: Setup & config model

1. [ ] Define the per-facet config (`paramKey`, `singularParamKey`, `operator`,
       `enum`, `dedicatedLandingPattern`) in a single web-side module; represent
       accommodation type / event category / blog category (OR) and destinos (AND,
       out-of-backend-scope, documented). Extensible for gastronomía/experiencias.

### Phase 2: Backend — schemas, models, services (events + blog)

2. [ ] Add `categories: createArrayQueryParam(...)` to `EventSearchHttpSchema` and
       `PostSearchHttpSchema` (keep singular `category`). Unit tests for parse.
3. [ ] Add the manual `inArray`-vs-`eq` category branch to `EventModel` and
       `PostModel` (mirror `AccommodationModel`). Model tests (1/N values, precedence,
       empty).
4. [ ] Forward `filters.categories` in `event.service.ts` / `post.service.ts`.
       Service + API integration tests, including the regression on `?categories=A,B`.

### Phase 3: Frontend — multi-toggle helper + chip behavior

5. [ ] Add `buildMultiToggleParamHref` (accumulate/remove a value in a CSV param,
       preserve others, drop `page`). Unit tests.
6. [ ] Extend chip rows to compute `active` per value + render `aria-pressed`, and
       add the "Clear (N)" chip (appears at 2+; reuses the removable active-filter-chip
       pattern). Component tests.
7. [ ] Switch the accommodation-type chip from dedicated-route navigation to the
       in-place multi-toggle (keep the dedicated landing intact — Phase 5).

### Phase 4: Sidebar key alignment

8. [ ] Rename the events/blog sidebar category `FilterGroup` id `category` →
       `categories` so `filter-reducer` serializes the array param the backend now
       accepts. Sync tests (chip ↔ sidebar ↔ URL); resolve `<a>` vs `<button>` per OQ-2.

### Phase 5: SEO — canonical & noindex for 2+ values

9. [ ] Extend `resolvePromotedFacetCanonical` (or a sibling) with the shared
       2+-value predicate: `noindex,follow` + canonical → base listing; 1 value →
       dedicated-landing canonical; 0 → base. Verify dedicated landings still resolve.
       SEO tests.

### Phase 6: Testing

10. [ ] Complete the test matrix in "Testing Strategy" across unit/model/service/
        API/frontend/SEO, including every named edge case and the destinos + singular
        backward-compat regression guards.

### Phase 7: Docs & cleanup

11. [ ] Document the per-facet operator model + the "SSR/URL is the single filter
        state source" principle in `apps/web/CLAUDE.md`; note the closed latent bug;
        file `closeout.md`; record decisions on the Linear issue; apply any
        `status-needs-smoke-*` label if live SEO/index verification is wanted.

## Open Questions

> **All four resolved by the owner on 2026-07-10 — the recommended defaults were
> confirmed. They are now contract, not open. Kept here as a decision log.**

- **OQ-1 — canonical/index behavior for 2+ selected values. → RESOLVED:
  `noindex,follow` + canonical → base listing without facet params.** (Rationale in
  US-7: a union of facet values has no distinct search intent worth an indexed URL,
  and it prevents combinatorial duplicate explosion; mirrors `/busqueda/` noindex.)
  Alternative considered and **rejected**: canonicalize the 2+-value URL to the
  **first** value's dedicated landing — misrepresents the page (it shows a union,
  not one type) and could leak an arbitrary "primary" value.
- **OQ-2 — chip element: `<a>` anchor vs `<button>`. → RESOLVED: keep `<a>` with
  `aria-pressed`.** Each href stays a valid navigable URL (progressive-enhancement
  friendly, works without JS, shareable). Rejected: `<button>` + client JS (breaks
  no-JS and shareable-link semantics).
- **OQ-3 — invalid array member: strict 400 vs lenient drop. → RESOLVED: strict
  400.** Matches the singular enum's existing strictness; a crafted bad URL fails
  loudly. Rejected: silently drop invalid members (hides typos). US-11's primary
  criterion (strict 400) is the pinned behavior.
- **OQ-4 — duplicate members (`?types=A,A`). → RESOLVED: de-duplicate on parse.**
  Cleaner URLs and canonical stability; `?types=A,A` normalizes to `?types=A`.

## Internal Review Notes

**Strengthened during authoring.**

- Modeled the combination operator as **declared per-facet config** (not a
  hardcoded global), so the HOS-97 sibling can add gastronomía/experiencias by
  declaring config — directly serving the owner's "extensible" requirement.
- Made the **accommodation `types` path the explicit blueprint** and required
  events/blog to replicate it exactly (schema array param → manual `inArray` model
  branch with array-over-singular precedence → service pass-through), because the
  generic `buildWhereClause` silently mis-handles arrays (`eq(column, arrayValue)`)
  — this is the root cause of the latent bug and is called out in US-2/US-9 and the
  risk table.
- Anchored the **latent bug** (sidebar already serializes `?category=A,B`, backend
  rejects it) as first-class motivation + a regression test that must be RED on
  `main` and GREEN after (M-3, US-9) — so a junior cannot "fix" it without proving
  the fix.
- Pinned the **URL as the single shared state** between chips and sidebar (no
  in-memory store) and made it assertable (a crafted URL alone reproduces the full
  selected state) — US-5/US-8.
- Preserved SEO: dedicated single-value landings stay canonical (US-6); 2+ values
  get one shared `noindex`/canonical predicate to avoid combinatorial duplicates
  (US-7) — no per-page divergence.
- Guarded **destinos** as an explicit no-op regression (US-12) so the one
  already-multi listing is not disturbed.

**No external-API verification.** This feature is entirely internal (schemas,
models, services, web) — there is NO third-party integration (no MercadoPago, no
external service) to smoke-test. The only "live" verification worth a
`status-needs-smoke-*` label is optional SEO/index behavior (canonical/`noindex`
for 2+ values) on staging, at the owner's discretion.

**Open questions for the owner.** OQ-1 (2+-value canonical/index — proposed
default given), OQ-2 (`<a>` vs `<button>` — recommend `<a>`+`aria-pressed`), OQ-3
(strict vs lenient invalid members — recommend strict), OQ-4 (duplicate members —
recommend de-dup). None blocks starting Phase 1-2 (backend), which is
decision-independent.

**Do NOT re-implement.** `FilterChips.astro` (canonical chip row) and
`buildToggleParamHref` (single-select helper) already exist from HOS-97; the
accommodation `types` param + model branch already exist. This spec **extends
behavior**, it does not rebuild the chip component or invent a new query-param
convention. Any implementer writing a new chip component or a DB migration should
stop and re-read the framing note.
