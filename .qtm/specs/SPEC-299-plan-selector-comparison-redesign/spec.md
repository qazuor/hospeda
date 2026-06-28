---
specId: SPEC-299
title: Plan Selector & Comparison Redesign
type: feat
complexity: medium
status: in-progress
created: 2026-06-27
tags: [web, billing, ui, ux, plans]
---

# SPEC-299 — Plan Selector & Comparison Redesign

> Visual and UX polish pass across the plan-selector cards, the CTA linking to
> the full comparison page, and the comparison table itself. Design is
> **not locked** — the first phase is a joint audit + direction agreement with
> the owner.

## 1. Summary

The pricing surface covers three URL families:

- `/[lang]/suscriptores/planes/` — owner plan selector (cards grid).
- `/[lang]/suscriptores/turistas/` — tourist plan selector (same cards grid, different copy).
- `/[lang]/suscriptores/planes/comparar/` and `/turistas/comparar/` — full comparison tables.

The owner's request covers four overlapping pain points: the cards look unpolished,
perceived card-height inconsistency distracts from the price, the button that links
to the full comparison page has no visual weight, and the comparison tables themselves
need layout and readability work.

This spec captures the problem, the candidate approaches, and a rich set of open
questions to resolve in a joint session with the owner before any code ships.

## 2. Current State — Key Files

| File | Role |
|------|------|
| `apps/web/src/components/billing/PricingCardsGrid.astro` | Shared plan-card grid (owners + tourists). CSS grid, `align-items: stretch`, monthly/annual toggle, `PlanPurchaseButton` island. |
| `apps/web/src/components/billing/PlanComparisonTable.astro` | Full comparison `<table>` with sticky first column, row groups, `<CheckIcon>` / `<MinusIcon>` cells, horizontal scroll on mobile. |
| `apps/web/src/pages/[lang]/suscriptores/planes/index.astro` | Owner selector page. Embeds `PricingCardsGrid` + a bare `GradientButton` to `/comparar/`. |
| `apps/web/src/pages/[lang]/suscriptores/planes/comparar/index.astro` | Owner comparison page. Hero + `PlanComparisonTable` + CTA back to `/planes/`. |
| `apps/web/src/pages/[lang]/suscriptores/turistas/index.astro` | Tourist selector (mirrors `/planes/`). |
| `apps/web/src/pages/[lang]/suscriptores/turistas/comparar/index.astro` | Tourist comparison page (mirrors `/planes/comparar/`). |

**Diagnosed issues (code-level):**

1. **Card height balance.** The grid already uses `align-items: stretch` and
   `display: flex; flex-direction: column` per card, so all cards technically
   reach the same height. But the highlighted card applies `transform: scale(1.02)`
   which visually lifts and enlarges it, creating perceived size mismatch. The
   `::before` "Recomendado" badge is pinned at `top: calc(var(--space-3) * -1)`,
   which can clip if the parent container has `overflow: hidden`. Additionally,
   `computeAddedEntitlements()` shows fewer bullets on higher-tier cards (incremental
   display), making cards feel unequal in visual weight even when pixel-heights match.

2. **Comparison CTA (button).** The link from the selector page to the full
   comparison is a single `GradientButton` inside a `comparison-link__container`
   with `text-align: center`. There is no surrounding context (no teaser copy, no
   visual section break), making it easy to overlook as it blends into whitespace.

3. **Comparison table.** The `<thead>` plan columns show name + price but no per-column
   CTA, no "most popular" highlight, and no visual accent distinguishing the
   recommended plan column. Row groups have a text header but no icon or badge.
   On mobile the table scrolls horizontally, which is functional but not delightful.

## 3. Goals (PROVISIONAL — subject to discovery review)

- **G-1** — Fix perceived card-height imbalance: address the `scale` + highlight
  badge approach so the recommended card stands out without disrupting flow.
- **G-2** — Improve overall card visual polish: typography hierarchy, spacing
  rhythm, feature-list legibility, and CTA button prominence within each card.
- **G-3** — Elevate the selector → comparison CTA into a recognizable section
  with enough context that users understand what they gain by clicking through.
- **G-4** — Add recommended-plan visual accent to the comparison table column
  headers so the table reinforces the card-grid recommendation.
- **G-5** — Improve comparison table readability: tighter row-group section
  headers, optional row icons/badges, better alternating-row contrast.
- **G-6** — Agree on a mobile comparison table strategy (horizontal scroll is the
  current default; alternatives in OQ-5).
- **G-7** — All changes stay within the app's styling constraints: vanilla CSS /
  CSS custom properties, no Tailwind, no inline hardcoded values.

## 4. Non-Goals

- No changes to the data model, API, or billing logic.
- No new entitlements or plan tiers — SPEC-282 and SPEC-283 own that surface.
- No new pages or routes; only existing pages and shared components are touched.
- No A/B testing infrastructure (tracked separately if needed).
- No Tailwind, no CSS-in-JS, no external UI library — styling is vanilla CSS only.
- Tourist pages may receive the same changes as owner pages, but only if the
  agreed visual direction applies identically; no tourist-specific divergence in
  this spec.

## 5. First Steps — Discovery Plan

The implementation MUST NOT start until the following are resolved with the owner:

1. **Screenshot audit.** Take browser screenshots of both pricing pages (desktop
   - mobile) and the comparison table. Present them to the owner with annotations
   marking the four pain points so the scope is concrete and shared.

2. **Card highlight strategy.** Decide between: (a) keep `scale(1.02)` but fix
   the badge overflow; (b) drop the scale and instead use a stronger border +
   background accent on the highlighted card; (c) raise highlighted card above
   siblings with `z-index` + box-shadow only (no scale). Show visual examples.

3. **Incremental vs full entitlement display.** Decide whether cards should
   continue showing only the delta over the previous tier, or switch to always
   showing the full list. This is a content strategy call before any layout work.

4. **Comparison CTA block.** Agree on the form: a plain button (current), a
   small teaser section with secondary heading + one-line description + button,
   or a card-style CTA. A quick HTML mockup in the scratchpad before committing.

5. **Comparison table column highlight.** Agree on how to mark the recommended
   column: a top border accent, a header background tint, or a full-column
   background stripe (the most visually prominent but potentially distracting).

6. **Mobile comparison table.** Decide on the strategy before writing any code
   (see OQ-5). The choice drives whether this is a CSS-only change or a
   structural HTML change.

## 6. Technical Notes (Preliminary)

- Styling tokens available: `--brand-accent`, `--brand-primary`, `--surface-warm`,
  `--core-card`, `--shadow-card`, `--shadow-card-hover`, `--radius-card`,
  `--space-*`. Any new visual treatment must use these — no hardcoded values.
- The monthly/annual toggle already works and must remain functional after any
  card-layout changes. The toggle is pure CSS + vanilla JS; no island needed.
- `PlanPurchaseButton` is a React island (`client:load`) inside each card; its
  position (currently `margin-top: auto` on the wrapper) must be preserved.
- The comparison table uses `position: sticky` on both the header row and the
  first column — changes to the table structure must not break either sticky.
- Both pages are SSR with `Cache-Control: s-maxage=300, stale-while-revalidate=60`.
  No data-fetching changes are needed for a pure UI pass.

## 7. Risks

- **R-1** — CSS subgrid for equal-height card sections (price area, feature list)
  has good support (Firefox 71+, Chrome 117+, Safari 16+) but needs verification
  against the project's browser support baseline before use.
- **R-2** — A full-column background stripe in the comparison table conflicts with
  the sticky first column (different stacking contexts); needs careful `z-index`
  planning.
- **R-3** — If the incremental entitlement display is replaced with full lists,
  cards with 10+ bullets will overflow on mobile; a max-height + "show more"
  interaction would add JS complexity not scoped here.
- **R-4** — Changes to the `PricingCardsGrid.astro` affect both owner and tourist
  pages (the component is shared). Visual regression on the tourist page must be
  verified explicitly.
- **R-5** — Any structural HTML change to `PlanComparisonTable.astro` (e.g. for
  a mobile accordion) breaks SPEC-282's semantically-accessible `<table>` intent
  and needs a fresh a11y review.

## 8. Open Questions

- **OQ-1** — Card highlight approach: `scale` (fix overflow) vs accent border vs
  shadow-only vs background tint? Drives the amount of CSS change needed.
- **OQ-2** — Incremental vs full entitlement list on each card: keep the
  delta-only approach (current) or show all bullets always? Owner decision.
- **OQ-3** — Should the CTA from the selector page to the comparison page be
  promoted to a full mini-section (heading + description + button), or is
  a more prominent standalone button sufficient?
- **OQ-4** — Should comparison table column headers include per-plan CTA buttons
  ("Elegir plan" or "Empezar") to allow direct purchase from the table without
  navigating back to the selector? That changes the table from purely informational
  to transactional, which may conflict with the current flow.
- **OQ-5** — Mobile comparison table strategy: (a) current horizontal scroll
  with a scroll hint indicator; (b) accordion per feature group (structure
  changes required); (c) stacked single-plan view with a plan picker dropdown
  (significant JS complexity). Which level of investment does the owner want?
- **OQ-6** — Should feature rows have icons in the label column (e.g. a small
  icon per row) or is that visual noise? Owner preference.
- **OQ-7** — "Most popular" or "Recomendado" marker in the comparison table
  column: banner on the column header, a badge on the plan name, or nothing
  (let the card selector carry that role alone)?
- **OQ-8** — Does this spec touch the tourist comparison table (`/turistas/comparar/`)
  in the same pass, or is the owner comparison the pilot and tourist follows in
  a follow-up? Scope decision before sizing.

## 9. Relationship to Existing Systems

- **SPEC-282** (Web — Plan Comparison Table Page, `completed`) — built
  `PlanComparisonTable.astro`, the comparison page route, and the row-group model
  that this spec may refine visually. Any structural changes must remain
  backward-compatible with SPEC-282's accessible `<table>` semantics.
- **SPEC-283** (Graduated Per-Plan AI Usage Limits, `in-progress`) — adds
  graduated numeric values to the AI rows in the comparison table. This redesign
  must not conflict with SPEC-283's cell rendering (limit-value cells already
  use `comparison-table__cell--limit` styling). Coordinate merge order to avoid
  conflicts in `PlanComparisonTable.astro`.
- **`GradientButton.astro`** — the shared CTA component used for the comparison
  link and the back-to-selector CTA. Any new CTA block reuses this component;
  do not introduce a new button primitive.
- **`PlanPurchaseButton.client.tsx`** — React island inside each card. Must
  remain functional and correctly placed after any card-layout changes.

## 11. Discovery Resolved — Owner Decisions (2026-06-28)

Joint discovery session completed against a real screenshot audit of the local
worktree (owner + tourist, desktop + mobile + DOM inspection). All eight open
questions are now LOCKED. Design direction is agreed; implementation may begin.

**Audit findings (evidence-backed):**

- **Card height imbalance is a CONTENT problem, not a layout one.** Cards already
  share height via `align-items: stretch`. The perceived imbalance comes from the
  delta-only entitlement display leaving the Premium card near-empty (2 bullets)
  while Básico is full (~22 bullets). Resolved by OQ-2.
- **Mobile selector is healthy (initial "defect" was a false positive).** The
  first audit pass appeared to show a huge white gap / overlap on mobile, but that
  was an artifact: the scroll-reveal animation leaves below-the-fold cards at
  `opacity: 0` in a full-page screenshot, and an over-broad selector mismeasured
  heights. With the reveal tripped and `.pricing-card` measured directly, the three
  cards stack cleanly (heights 1048 / 713 / 568px, 16px grid gap, no overlap,
  opacity 1). `align-items: stretch` only equalizes within the 3-column desktop row;
  in the 1-column mobile grid each card takes its natural height. No structural
  mobile fix needed.
- **Comparison CTA** is a bare button floating in whitespace (confirms G-3).
- **Comparison table** has no recommended-column accent and no per-column CTA; row
  groups are plain bars; many "Próximamente" badges (confirms G-4/G-5).
- **Tourist parity:** both pages use the shared `PricingCardsGrid.astro` /
  `PlanComparisonTable.astro`, so every change lands in both (confirms R-4).

**Locked decisions:**

| OQ | Decision |
|----|----------|
| **OQ-1** Card highlight | Accent border + warm background tint (`--surface-warm`), **no** `transform: scale`. Removes the physical enlargement and badge-clipping risk; heights stay perfectly even. |
| **OQ-2** Entitlements | Keep **incremental** ("Todo del plan anterior, más:") and fill the empty space on higher-tier cards with a **summary block** (e.g. "+22 del plan anterior"). Root fix for the height imbalance. |
| **OQ-3** Selector→compare CTA | **Mini-section with teaser**: secondary heading + one value line + reuse `GradientButton`. No new primitive. |
| **OQ-4** Per-column table CTA | **Yes** — mount `PlanPurchaseButton` in each plan column header (table becomes transactional). |
| **OQ-5** Mobile table | **Horizontal scroll + visible scroll hint**. CSS-only; does NOT change `<table>` structure → preserves SPEC-282 a11y (avoids R-5). |
| **OQ-6** Row icons | **Yes** — small icon per feature row from `@repo/icons` in the label column. Requires mapping one icon per table feature row (content work). |
| **OQ-7** Recommended column in table | **Nothing** — table stays neutral; the selector card carries the "recomendado" role alone. |
| **OQ-8** Scope | **Both owner + tourist** in this pass (shared components; single PR; verify both views). |

## 10. Revision History

- 2026-06-27 — Initial draft (SPEC-299 allocated). Design not locked. Goals
  provisional. Four code-level issues diagnosed (scale badge overflow, comparison
  CTA weight, table column highlighting, mobile table UX). Eight open questions
  (OQ-1..8) and a five-step discovery plan defined for the owner review session
  before implementation begins.
- 2026-06-28 — Discovery session completed (screenshot audit + owner sign-off).
  All eight open questions resolved (see section 11). Status flipped
  `draft` → `in-progress`. Implementation cleared to begin.
- 2026-06-28 — Implementation landed on `spec/SPEC-299-plan-selector-comparison-redesign`:
  (1) card highlight → accent border + warm tint, scale removed, badge headroom
  added (OQ-1); (2) inherited-tier summary block on incremental cards (OQ-2);
  (3) comparison CTA promoted to a teaser mini-section on both owner and tourist
  selectors (OQ-3); (4) per-column purchase CTA in the comparison table (OQ-4);
  (5) mobile horizontal-scroll hint (OQ-5); (6) per-row decorative icons mapped
  from `@repo/icons`, extracted to `comparison-row-icons.ts` (OQ-6). The mobile
  "defect" flagged in discovery was a false positive (reveal-animation screenshot
  artifact); no structural mobile work was needed (WU3 dropped). All changes verified
  in the local worktree across owner + tourist, desktop + mobile; `pnpm --filter
  hospeda-web typecheck` passes with 0 errors. SPEC-283's graduated-AI table work
  was already merged to staging, so no merge conflict in `PlanComparisonTable.astro`.
