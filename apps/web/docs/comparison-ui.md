# Accommodation comparison UI (HOS-85)

Reference for the client-only accommodation comparison feature: how a user
builds a selection across listing pages, and how that selection is presented
on `/{locale}/alojamientos/comparar/`. Supersedes the always-on compare icon
from the original SPEC-288 implementation.

## Entry points

| Surface | Component | Behavior |
| --- | --- | --- |
| Listing pages (6 pages: main listing, type filter, destination filter, map, amenity/feature pages) | `CompareModeToggle.client.tsx`, wrapped by `CompareModeControls.astro` | An explicit "compare mode" toggle mounted next to `ListingPageHeader`. Off by default. Turning it on reveals the per-card contextual add/remove control and switches the toggle's own label/style to communicate the active state — a separate explainer banner was removed post-review (too heavy for what it communicated; the toggle now carries the guidance copy inline). |
| Listing card body (grid + map sidebar) | `CompareButton.client.tsx` (`variant="contextual"`) | Rendered inside `AccommodationCard.astro` and `MapCardsSidebar.client.tsx`. Renders `null` (no DOM, no layout space) while compare mode is off, including on the SSR pass — the server snapshot for compare mode is always `false`. |
| Accommodation detail page | `DetailCompareButton.client.tsx`, mounted in `DetailHeader.astro` | Always-visible labeled button (no compare-mode gating) — the detail page shows exactly one accommodation, so there's no "mode" to toggle. Net-new for HOS-85; reuses the same `useCompareGuard` entitlement/limit logic as the listing button. |

Compare mode is scoped to `/{locale}/alojamientos/*`. `BaseLayout.astro` calls
`clearCompareModeIfOutsideSection(window.location.pathname)` on every
`astro:page-load` event (initial load and every View Transitions navigation),
so leaving the accommodation section turns the flag off automatically.

## Selection state

`src/store/compare-store.ts` is a client-only, framework-agnostic store (no
network calls) with two independent pieces of state, each with its own
`useSyncExternalStore`-based hook:

- **Selection** (`useCompareStore` / `addToCompare` / `removeFromCompare` /
  `toggleCompare` / `isInCompare` / `clearCompare`) — the set of accommodation
  IDs plus their card metadata (name, thumbnail), persisted to `localStorage`.
- **Compare mode** (`useCompareMode` / `setCompareMode` / `toggleCompareMode`)
  — whether the contextual per-card controls are visible on listing pages,
  also persisted to `localStorage` independently of the selection.

`useCompareGuard` (a hook, not part of the store) wraps `toggle()` with
entitlement + per-plan limit checks, returning `{ action: 'added' | 'removed'
| 'blocked', reason: 'upsell' | 'limit' | null }` so callers can surface the
right toast. The comparison page itself re-validates the same cap server-side
when it hydrates.

## Compare bar

`CompareBar.client.tsx` — a floating bar shown while the selection is
non-empty. Shows an N-of-M counter against the plan's max, empty slot
placeholders, brief guidance copy, and a "Ver comparación" CTA to the
comparison page. Anchors to the viewport bottom on mobile, with a z-index
(`--z-toast + 10`) deliberately raised above the mobile filters trigger and
list/map view toggle so it isn't visually covered by those floating controls
(post-review fix — see the rationale comment on `.bar` in
`CompareBar.module.css`).

## Comparison matrix

`ComparisonMatrix.client.tsx` renders the side-by-side attribute table on the
comparison page itself.

- **Diff highlighting** — a toggle (`highlightDiffs`, default on) that shades
  cells whose value differs across the compared accommodations for that row.
- **Best-value markers** — `computeBestValue()` (`computeBestValue.ts`, a pure
  helper with no React/store dependency) flags the cheapest price and the
  highest average rating; the matrix renders an amber badge (desktop) or dot
  (mobile) using `var(--rating-star)` next to the winning cell(s). Ties are
  possible — the helper returns every tied ID, not a single winner.
- **Mobile layout** — the attribute label column stays sticky-left
  (`.stickyCol`) while the accommodation columns become a horizontally
  scrollable, scroll-snapping row, with a decorative "Deslizá para ver más →"
  scroll hint.

## Key files

```
src/store/compare-store.ts                                  selection + mode state
src/hooks/useCompareGuard.ts                                 entitlement/limit-gated toggle
src/components/shared/compare/
  CompareButton.client.tsx                                   contextual per-card control (+ legacy standalone/compact variants, see below)
  CompareModeToggle.client.tsx                                listing-page mode switch (label/style communicate active state)
  CompareModeControls.astro                                   wrapper mounting the toggle next to ListingPageHeader
  CompareBar.client.tsx                                        floating selection bar
  ComparisonMatrix.client.tsx                                  comparison page table
  computeBestValue.ts                                          pure best-price/best-rating helper
src/components/accommodation/DetailCompareButton.client.tsx    detail-page entry point
```

## Note: unused `CompareButton` variants

`CompareButtonProps.variant` still accepts `'standalone'` and `'compact'`
alongside `'contextual'`. Both predate HOS-85 (SPEC-288) and had exactly one
production call site each (the old always-visible actions-column icon in
`AccommodationCard.astro` and `MapCardsSidebar.client.tsx`); HOS-85 replaced
both call sites with `variant="contextual"`. As of this writing neither
`standalone` nor `compact` has a production call site, but the default
(`standalone`) is still the vehicle several `CompareButton.test.tsx` cases use
to exercise the shared toggle/guard/toast logic, so the type was left as-is
rather than narrowed — removing it would mean redesigning the component's
variant API, which is out of scope for a cleanup pass. Revisit if the
component is touched again.
