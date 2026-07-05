---
title: "Accommodation comparison UI redesign"
linear: HOS-85
statusSource: linear
type: feature
areas: [web]
complexity: medium
created: 2026-07-04
---

# Accommodation comparison UI redesign

> Frontend-only (`apps/web`) redesign of the existing accommodation comparison
> feature (built under the legacy SPEC-288, never migrated to a HOS issue). No
> backend, schema, or DB changes. Tracked in Linear as **HOS-85**.

## 1. Overview

### Goal

Make the accommodation comparison feature **discoverable and understandable for
non-technical users**, on desktop and — primarily — mobile. The feature already
works end-to-end; the problem is purely UX: a mute trigger icon, a floating bar
that explains nothing, and a comparison matrix that dumps plain-text data with no
hierarchy.

### Motivation

Owner feedback: "the comparison exists but nobody discovers it, and the icon is
not clear." The main audience is mobile, where the current matrix (a shrunk
desktop table) is unusable.

### Success criteria

- A non-technical user can discover the feature, build a comparison, and
  understand the differences without help.
- On mobile, the comparison view is usable with no broken horizontal scroll and
  the attribute labels always visible.
- The comparison can be started from both the listing (compare mode) and the
  accommodation detail page.
- Zero backend changes; only the 7 fields the endpoint already returns are
  compared.

## 2. User Stories & Acceptance Criteria

### US-1 — Listing: discoverable "compare mode" (replaces the mute icon)

The per-card compare control is NOT permanently visible (the card photo is
already saturated: `Nuevo`/`Destacado`/`Verificado`/`Chat IA` badges + an
actions column with favorite/compare/photo-count). Instead a compare **mode** is
toggled from the listing toolbar.

- **Given** I am on the accommodation listing, **when** I look at the toolbar
  (next to Filters / Sort), **then** I see a prominent, labeled toggle
  **"Comparar alojamientos"**.
- **Given** compare mode is OFF, **then** the cards show no compare control (clean).
- **Given** I activate compare mode, **then** every card reveals an "Agregar"
  control AND a mode banner appears ("Modo comparación activo · elegí los
  alojamientos que querés comparar").
- **Given** compare mode is ON, **when** I tap a card's "Agregar" control,
  **then** the card is added to the selection and shows a selected affordance;
  tapping again removes it.
- **Given** I deactivate compare mode, **then** the per-card controls and the
  banner disappear; the current selection is preserved (it lives in the store /
  is shown in the bar), it is not cleared.
- The current mute compare icon in the card actions column is removed.
- **Mode persistence**: compare mode stays ON while I browse within
  `/{lang}/alojamientos/*` (paginate, filter); it turns OFF when I leave the
  accommodation section.

### US-2 — Educating selection bar

- **Given** I have ≥1 accommodation selected, **then** a floating bar shows
  "Comparás N de M", empty slots up to the plan cap (M from
  `useCompareGuard`/`max_compare_items`), and a CTA "Ver comparación →".
- **Given** I have exactly 1 selected, **then** the bar shows the guidance
  subtitle ("Sumá al menos uno más…") and the CTA is disabled.
- **Given** I am on mobile, **then** the bar is anchored to the bottom (above the
  navigation).
- **Given** I remove all items, **then** the bar disappears.

### US-3 — Desktop comparison view: differences + best value

- **Given** I am on the comparison view, **then** the table highlights rows where
  the values differ, controlled by a "Resaltar diferencias" toggle that is ON by
  default.
- **Given** a numerically comparable row (price, rating), **then** the best value
  is marked in amber (cheapest price / best rating).
- **Given** I turn the toggle off, **then** the difference highlighting is removed
  but the best-value markers remain.

### US-4 — Mobile comparison view

- **Given** I am on mobile, **then** the attribute column is fixed (sticky-left)
  and the accommodation columns scroll horizontally with scroll-snap.
- **Given** a best value exists in a row, **then** it is shown as an amber dot.
- The desktop table is never merely shrunk; headers do not scroll away from their
  values.

### US-5 — Detail page: direct compare entry (new)

Not implemented today (`CompareButton` is only used in `AccommodationCard.astro`
and `MapCardsSidebar.client.tsx`).

- **Given** I am on an accommodation detail page (`[slug].astro`), **then** I see
  a direct, always-visible button "Agregar a comparación" near the primary CTA.
  There is no compare mode here (single item).
- **Given** I tap it, **then** the accommodation is added to the selection and the
  button switches to "En comparación ✓"; tapping again removes it.
- **Given** I added from the detail and return to the listing, **then** the global
  bar already reflects my selection.

## 3. Technical Approach

Frontend only. All UI text through `@repo/i18n`; CSS Modules / Astro scoped styles
with design tokens (no Tailwind); named exports; RO-RO; React islands with
`client:visible`/`client:idle`. **No changes** to the endpoint, service, schema,
or DB.

### Compare-mode state

- Extend the existing client-side compare store (`compare-store.ts`) — or add a
  small sibling store — with a `mode: boolean` plus toggle, using
  `useSyncExternalStore`. Persist mode scoped to `/alojamientos/*` (e.g. clear on
  navigation away from the accommodation section). The **selection** persistence
  is unchanged (localStorage, as today).

### Components / files

- **`AccommodationCard.astro`**: remove the `<CompareButton>` from the
  `.acc-card__actions` column; render the contextual compare control in the card
  body, shown only when compare mode is ON.
- **`CompareButton.client.tsx`** (+ `.module.css`): new contextual variant with
  add/remove state ("Agregar" ↔ "Agregado ✓" / selected affordance).
- **Listing toolbar toggle** (new small island or extension of the existing
  toolbar) + **mode banner**, wired into `alojamientos/index.astro` and
  `alojamientos/page/[page].astro` (and any listing variant: `tipo/[type]`,
  `caracteristicas`, `comodidades`, destination listings — audit during
  implementation for consistency).
- **`CompareBar.client.tsx`** (+ `.module.css`): counter "N de M", plan-cap empty
  slots, guidance subtitle, CTA, mobile bottom anchor.
- **`ComparisonMatrix.client.tsx`** (+ `.module.css`): diff-highlight toggle
  (default on) + `computeBestValue` pure helper + amber marker. Mobile: sticky
  attribute column + `overflow-x` + `scroll-snap-type` + amber dot.
- **Detail**: `[lang]/alojamientos/[slug].astro` (+ its detail header component):
  direct "Agregar a comparación" button island.
- **`MapCardsSidebar.client.tsx`**: align its `CompareButton` usage with the new
  contextual behavior for consistency.
- **i18n**: new keys under `accommodations.json > comparison.*` in `es/en/pt`
  (mode toggle/banner, contextual button states, bar counter/guidance, matrix
  toggle/best-value, mobile hint, detail button).

### Best-value amber token (open decision — see Internal Review Notes)

Reuse an existing **generated** token (tokens come from `packages/design-tokens`,
not hand-authored CSS). Candidates: `--rating-star` (gold, already positive
connotation), `--warning` (amber but wrong semantic name), or add a dedicated
`--highlight`/`--best-value` token via the design-tokens pipeline. **Recommended
default: `--rating-star`** to avoid the pipeline dependency; revisit if the
star-color coupling is undesirable. Never hardcode the color.

## 4. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Compare mode hidden → worse discoverability (the exact problem we're solving) | Feature stays undiscovered | Toggle is prominent + labeled in the toolbar; explicit mode banner |
| "Mode" confuses non-technical users (cards change unexpectedly) | Confusion | Clear mode banner + selected affordance + persistent toggle highlight |
| Sticky + scroll-snap mobile table bugs cross-browser | Broken mobile view | Manual smoke on iOS Safari + Chrome Android |
| Reusing a token with mismatched semantics | Design debt | Resolve the token decision (open question) before implementation |
| Listing has several variants (tipo/caracteristicas/comodidades/destinos) | Inconsistent toggle placement | Audit all listing entry points; centralize the toolbar/toggle |

## 5. Testing Strategy

No tests = not done. AAA pattern.

- **Unit (pure logic)**: compare-mode store (toggle, persist, scope to
  `/alojamientos/*`); `computeBestValue` (cheapest price, best rating, ties);
  `useCompareGuard` interplay with mode.
- **Component (testing-library)**: `CompareButton` contextual states
  (hidden off-mode, add/remove); `CompareBar` rendering by count (0/1/N/at-cap)
  and CTA enabled/disabled; `ComparisonMatrix` diff on/off + best-value marker;
  detail add button toggle.
- **Source-assert (Astro)**: `AccommodationCard.astro` — compare icon removed from
  actions, contextual control present; i18n keys present in `es/en/pt`.
- **Manual / E2E smoke**: full desktop + mobile flow — toolbar toggle → mode
  banner → select cards → bar "N de M" → comparison view → mobile sticky scroll;
  detail-page add → bar reflects selection.

## 6. Out of Scope

Expanding **comparable attributes** (capacity, bedrooms, bathrooms,
amenities/features). These are not in the current `compareByIds` /
`AccommodationSummary` response and require backend work (endpoint, response
schema, many-to-many joins in service-core/db). Tracked as a **future follow-up
spec**, not here. "Best value" therefore applies only to price and rating in this
spec.

## 7. Suggested Tasks (preliminary)

Formal task generation (`task-from-spec`) runs when implementation starts
(Phase 2). Preliminary breakdown by phase:

**Setup**
- Add i18n keys (`comparison.*`) in `es/en/pt`.
- Resolve the best-value amber token decision.

**Core**
- Compare-mode state in the store (toggle + scoped persistence).
- Listing toolbar toggle + mode banner (+ wire into all listing entry points).
- `CompareButton` contextual variant; remove mute icon from `AccommodationCard`.
- `CompareBar` redesign (counter, plan-cap slots, guidance, CTA, mobile anchor).
- `ComparisonMatrix` desktop (diff toggle + best-value marker).
- `ComparisonMatrix` mobile (sticky column + scroll-snap + amber dot).
- Detail-page direct "Agregar a comparación" button.

**Integration**
- Align `MapCardsSidebar` compare usage.
- Ensure global bar appears on listing + detail when selection non-empty.

**Testing**
- Unit + component + source-assert tests.
- Manual desktop + mobile smoke.

**Docs / cleanup**
- Update `apps/web` docs / changelog; remove dead compare-icon styles/props.

## Internal Review Notes

### Open questions (need owner input before/at implementation)

1. **Best-value amber token**: reuse `--rating-star` (recommended, no pipeline
   dependency) vs. add a dedicated `--best-value` token via `design-tokens`
   (cleaner semantics, heavier). Deferred to implementation start.

### Strengthened during review

- Confirmed the detail page has NO compare entry today (grep: `CompareButton`
  used only in `AccommodationCard.astro` + `MapCardsSidebar.client.tsx`) → US-5 is
  net-new.
- Confirmed design tokens are generated by `packages/design-tokens`, not
  hand-authored → the amber marker must reuse a generated token, not a literal.
- Flagged that the listing has multiple entry points (tipo / caracteristicas /
  comodidades / destination listings) → the toolbar toggle must be centralized to
  stay consistent.
