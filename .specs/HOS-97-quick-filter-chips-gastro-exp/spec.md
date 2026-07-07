---
title: Quick-filter chips for gastronomía and experiencias
linear: HOS-97
statusSource: linear
created: 2026-07-07
type: feature
areas:
  - web
---

# Quick-filter chips for gastronomía and experiencias

## 1. Summary

Add the quick-filter chip row (the horizontal row of tappable pills above the
listing grid that filters by a single facet) to the **gastronomía** and
**experiencias** listing pages, for parity with accommodations, destinos,
eventos and blog. Along the way, extract a real canonical `FilterChips`
component so BETA-113's "one chip style" intent is finally backed by one
component, not just shared CSS across three divergent implementations.

## 2. Problem

The quick-filter chip row exists on most listings but not all:

| Listing | Chip row | Facet |
|---|---|---|
| Alojamientos | ✅ | accommodation type |
| Destinos | ✅ | attraction (multi-select) |
| Eventos / Blog | ✅ | category |
| **Gastronomía** | ❌ | — |
| **Experiencias** | ❌ | — |

Gastronomía and experiencias force the user into the sidebar checkbox group to
filter by type, while every other listing offers the faster chip shortcut. This
is an inconsistency users notice (raised while discussing BETA-113).

Secondary problem surfaced during scoping: **BETA-113 only unified the CSS look
of the chips, not the component.** Three separate implementations still exist
with divergent behavior (see §5). Adding a fourth ad-hoc chip row to two more
pages would deepen that debt. This spec instead introduces the canonical
component the parent issue implied but never delivered.

## 3. Goals

- **G-1** — Gastronomía listing shows a quick-filter chip row that filters by
  `GastronomyTypeEnum` (tipo de espacio: restaurante, bar, café, …).
- **G-2** — Experiencias listing shows a quick-filter chip row that filters by
  `ExperienceTypeEnum` (tipo/categoría de experiencia).
- **G-3** — Both chip rows: single-select, in-place `?type=` toggle (click to
  filter, click again to clear), with a leading icon per chip, matching the
  eventos interaction model and BETA-113's visual style.
- **G-4** — Extract a canonical `FilterChips` Astro component and use it for the
  two new rows. Migrate the existing single-select / route-navigation surfaces
  (eventos, blog, alojamientos) to it in a controlled, phased way.

## 4. Non-goals

- **NG-1** — No new filter capability: the `type` param is already supported
  end-to-end (schema → HTTP schema → public API → web wrapper → page). This is
  additive UI over existing plumbing, not backend work.
- **NG-2** — No "tipo de cocina" facet for gastronomía. No such enum exists;
  creating one is out of scope (YAGNI). Gastronomía filters by `GastronomyType`
  (tipo de espacio) only.
- **NG-3** — No multi-select for gastronomía/experiencias chips (single-select
  only, per G-3). The API `type` param is scalar; multi-select would require a
  schema/API/service change and is deferred to the multi-select sibling issue.
- **NG-4** — Migrating **destinos** to the canonical component is NOT committed
  in this spec — it needs a multi-select + overflow mode the canonical
  component doesn't have on day one (see R-1 / OQ-1).
- **NG-5** — Not fixing the pre-existing i18n key inconsistency
  (`gastronomy.types.*` plural vs `experience.type.*` singular) unless it's
  trivial in passing (see §12).

## 5. Current baseline

**Plumbing already end-to-end for both pages** — a chip row is purely additive UI:

- `apps/web/src/pages/[lang]/gastronomia/index.astro` (~361 lines): reads
  `type` from `Astro.url.searchParams`, passes it to `gastronomyApi.list()`,
  already renders a `type` checkbox `FilterGroup` in the sidebar
  (`GASTRONOMY_TYPES`). Chip row slots in right after the closing
  `<FilterSidebar slot="filters" .../>` (~line 296) and before the
  `{hasError && ...}` block.
- `apps/web/src/pages/[lang]/experiencias/index.astro` (~336 lines): same shape
  with `EXPERIENCE_TYPES`. Insertion point ~line 285.

**Facet enums:**

- `GastronomyTypeEnum` — `packages/schemas/src/enums/gastronomy-type.enum.ts`
  (9 values: `RESTAURANT, BAR, CAFE, PARRILLA, CERVECERIA, HELADERIA,
  PANADERIA, ROTISERIA, FOOD_TRUCK`). Exposed as `type` in
  `GastronomyFiltersSchema` / `GastronomySearchSchema` /
  `GastronomySearchHttpSchema`.
- `ExperienceTypeEnum` — `packages/schemas/src/enums/experience-type.enum.ts`
  (14 values: `CAR_RENTAL, BIKE_RENTAL, KAYAK_RENTAL, QUAD_RENTAL, TOUR_GUIDE,
  GUIDED_VISIT, EXCURSION, BOAT_TRIP, FISHING_CHARTER, BIRD_WATCHING,
  CULTURAL_TOUR, WINE_TASTING, OUTDOOR_ADVENTURE, OTHER`). Exposed as `type`
  in the equivalent experience schemas.

**Public API endpoints already support `type`:**

- `apps/api/src/routes/gastronomy/public/list.ts` — `GET /api/v1/public/gastronomies`.
- `apps/api/src/routes/experience/public/list.ts` — `GET /api/v1/public/experiences`.
- Web wrappers: `gastronomyApi.list({ type })` / `experiencesApi.list({ type })`
  in `apps/web/src/lib/api/endpoints.ts`.

**Existing chip implementations (BETA-113 unified CSS, not the component):**

1. `apps/web/src/components/TagChips.astro` — the only generic, prop-driven one
   (`chips: { label, href, active?, icon? }[]`). Used by eventos (in-place
   single-select `?category=` toggle) and blog (dedicated-route navigation).
2. `apps/web/src/components/shared/ui/AccommodationTypeBadge.astro` — dual
   decorative/interactive; the interactive variant is the alojamientos chip
   (dedicated-route `/alojamientos/tipo/{slug}/`).
3. Inline markup in `apps/web/src/pages/[lang]/destinos/index.astro`
   (`dest-attractions-filter`) — not extracted, multi-select `?attractions=id,id`
   toggle + a "+N more" `<details>` overflow disclosure.

No icon-mapping helper exists for gastronomy/experience types (accommodations
has `lib/accommodation-type-icons.ts`, events/blog have their own). Icon parity
requires net-new helpers.

## 6. Proposed design

Phased, so the user-facing value (G-1..G-3) ships without waiting on the full
migration (G-4).

### Phase 1 — canonical component + the two new rows (delivers the issue)

1. Extract `apps/web/src/components/shared/ui/FilterChips.astro` (canonical).
   - Props (RO): `chips: FilterChip[]`, `ariaLabel: string`, where
     `FilterChip = { label: string; href: string; active?: boolean; icon?: <IconComponent> }`.
   - Behavior: renders a scrollable `<nav>` of `<a>` chips using the BETA-113
     visual tokens (`--core-card` rest, `--brand-accent` hover/active,
     `6px 16px` padding, `--text-body-sm`, pill radius), plus the scroll-fade JS
     already in `TagChips.astro`.
   - This is essentially `TagChips.astro` promoted to `shared/ui/` and made the
     one canonical home. `TagChips.astro` becomes a thin re-export or is removed
     once its two callers migrate (Phase 2).
2. Create icon helpers:
   - `apps/web/src/lib/gastronomy-type-icons.ts` — `GastronomyTypeEnum` value → `@repo/icons` component.
   - `apps/web/src/lib/experience-type-icons.ts` — `ExperienceTypeEnum` value → `@repo/icons` component.
3. In `gastronomia/index.astro` and `experiencias/index.astro`:
   - Build a `chips` array iterating the enum, each chip: `label` from i18n
     (`gastronomy.types.${v}` / `experience.type.${v}`), `icon` from the helper,
     `href` = current URL with `type` toggled (set if inactive, removed if it's
     the active one), `active` = `currentType === v`.
   - Render `<FilterChips>` at the insertion point identified in §5.
   - Keep the sidebar checkbox group; chips are a redundant-but-faster shortcut
     for the same `type` param (same relationship TagChips↔FilterSidebar has in
     eventos). Ensure the active chip and the checked sidebar box stay
     consistent for a given `?type=` (they read the same param, so they will).

### Phase 2 — migrate the single-select / route-nav surfaces to `FilterChips`

- Eventos and blog (both already use `TagChips.astro`) → point at
  `FilterChips.astro`. Mechanical, same prop shape.
- Alojamientos → replace the interactive `AccommodationTypeBadge` chip usage in
  the listing with `FilterChips` (route-nav hrefs). The decorative
  `AccommodationTypeBadge` on cards/detail headers stays untouched.
- After migration, retire `TagChips.astro`.

### Phase 3 — destinos (conditional, see OQ-1)

Only if the owner wants full consolidation: teach `FilterChips` a `multiSelect`
mode + overflow "+N more" disclosure so it can absorb the destinos inline
implementation. Otherwise destinos stays as-is and is explicitly out of scope
(NG-4).

## 7. Data model / contracts

None. No schema, migration, enum, API route, or query-param change. Every enum
and endpoint listed in §5 already exists and already supports `type`.

## 8. UX / UI behavior

- Row of pill chips above the grid, horizontally scrollable on narrow viewports
  with the existing scroll-fade edges.
- Each chip: leading icon + translated label.
- Click an inactive chip → navigate to the same URL with `?type=<value>` set →
  grid re-renders filtered. Click the active chip → `?type=` removed → back to
  unfiltered.
- Exactly one chip active at a time (single-select). The active chip uses the
  `--brand-accent` treatment.
- Active chip ⇄ sidebar checkbox for the same `type` stay in sync (both derive
  from the URL param).
- Chips are keyboard-navigable links (`<a>`), same a11y baseline as the existing
  `TagChips` rows.

## 9. Acceptance criteria

- **AC-1** — Gastronomía listing renders a chip row of `GastronomyTypeEnum`
  values, each with icon + translated label; clicking one filters the grid via
  `?type=`, clicking it again clears.
- **AC-2** — Experiencias listing renders the equivalent chip row for
  `ExperienceTypeEnum`.
- **AC-3** — Only one chip is active at a time; the active chip and the matching
  sidebar checkbox reflect the same `?type=` value.
- **AC-4** — Both rows use the new canonical `FilterChips.astro` (not a fourth
  ad-hoc copy), styled per BETA-113 tokens.
- **AC-5** — Chip rows are horizontally scrollable with fade edges on mobile and
  keyboard-accessible.
- **AC-6** — Eventos and blog render identically after migrating to
  `FilterChips` (visual + behavioral no-op); `TagChips.astro` retired.
- **AC-7** — Icon helpers cover every enum value (no missing-icon fallback gaps),
  guarded by a unit test asserting full enum coverage.
- **AC-8** — No backend/schema/migration change in the diff.

## 10. Risks

- **R-1** — Destinos' multi-select + "+N more" overflow does not fit a
  single-select canonical component. Absorbing it (Phase 3) means adding a
  `multiSelect` mode; scope creep if pulled into this spec. Mitigation: Phase 3
  is conditional and gated on OQ-1; default is to leave destinos out (NG-4).
- **R-2** — Migrating alojamientos touches a dual-purpose component
  (`AccommodationTypeBadge`); must not disturb its decorative badge usage on
  cards/detail headers. Mitigation: migrate only the interactive-chip call site,
  leave the badge variant alone.
- **R-3** — Icon parity requires picking a sensible `@repo/icons` glyph for 9 + 14
  enum values; some (e.g. `OTHER`, `ROTISERIA`) have no obvious icon. Mitigation:
  a deliberate default glyph + the AC-7 coverage test.
- **R-4** — Phase 2 migration is a visual/behavioral no-op that touches
  high-traffic listings; regressions are subtle. Mitigation: keep Phase 2 as its
  own PR, verify eventos/blog/alojamientos visually before merge.

## 11. Open questions

- **OQ-1** — Do we consolidate **destinos** into `FilterChips` (Phase 3, needs
  multi-select mode) in this spec, or leave it for the multi-select sibling
  issue? Default assumption: leave it out (NG-4).
- **OQ-2** — Icon set: is there an approved icon per gastronomy/experience type,
  or does the implementer choose from `@repo/icons` (subject to owner review of
  the picks)? Default: implementer proposes, owner reviews in the live PR.
- **OQ-3** — Scope of this spec's PR(s): ship Phase 1 alone first (fastest path
  to the issue's ask), then Phase 2 as a follow-up PR under the same HOS-97, or
  bundle 1+2? Recommendation: Phase 1 first (closes the visible gap), Phase 2 as
  a second PR.

## 12. Implementation notes

- Insertion point in both pages mirrors eventos/publicaciones: right after the
  closing `<FilterSidebar slot="filters" .../>` and before `{hasError && ...}`.
- i18n keys already exist (sidebar checkboxes use them): `gastronomy.types.${v}`
  (plural) and `experience.type.${v}` (singular). The singular/plural mismatch
  is pre-existing; if trivial, normalize while here, else leave and note (NG-5).
- Follow web conventions: Astro component, vanilla CSS / CSS Module colocated,
  `@repo/icons` for icons, `@repo/i18n` for labels, no Tailwind.
- The `href` toggle logic (set/remove `type` on the current URL preserving other
  params like `q`, `destinationId`, `sortBy`) should reuse the same pattern
  eventos uses for its `?category=` toggle — extract a tiny helper if it isn't
  already shared.

## 13. Linear

Canonical tracking:
HOS-97
