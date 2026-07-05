---
title: Wave Header Rework (Detail & Listing Pages)
linear: HOS-84
statusSource: linear
status: in-implementation
decision: "Opt-B band puro (both surfaces) + HYBRID 3-state behavior on detail (expanded/compact/hidden) + static band on listing; shared-component rework with per-page compact override preserved; dedicated --surface-header token; back button added"
created: 2026-07-04
type: feature
areas:
  - web
---

# Wave Header Rework (Detail & Listing Pages)

## 1. Summary

The "wave header" — the celeste/light-blue wave banner at the top of public detail
pages — does not satisfy the owner across three dimensions: its **behavior** (scroll /
compact interaction), its **visual aesthetics** (shape, color, premium feel), and its
**content hierarchy** (what sits inside it and how it's prioritized). This is a
**discovery-first** spec: its first deliverable is an owner-facing options-and-tradeoffs
analysis, explicitly including the option to **replace the wave concept entirely**, not
just polish it. Implementation is deferred until the owner picks a direction.

## 2. Problem

The current wave header is a single shared component rendered at the top of every public
detail page (and, unavoidably, every listing page — see §5). The owner reports it
"doesn't quite convince" on three fronts:

1. **Behavior** — how it compacts on scroll, how it hands off to the content below,
   transitions.
2. **Aesthetics** — the wave silhouette, the color, an overall feel that reads dated
   rather than premium. The owner is **open to dropping the wave concept**.
3. **Content hierarchy** — the set and priority of elements inside the header (title,
   breadcrumb, badges, rating, favorite, CTA) does not clearly tell each page's story.

Per-page **consistency** (how each entity type resolves its header) was explicitly
excluded by the owner as the primary pain, though §5 shows it is a latent contributor
(6 duplicated CSS blocks) that the discovery phase should still surface.

Why now: the platform is approaching v1; the detail page is the primary conversion
surface (accommodation → contact/booking), and its header is the first thing a visitor
sees below the nav.

## 3. Goals

- G-1 — Produce an **options + tradeoffs document** for the wave header's visual
  direction (keep-and-restyle vs. replace), with enough fidelity (mockups / reference
  images) for the owner to choose. **This is the gating deliverable.**
- G-2 — Diagnose and specify the **behavioral** improvements (scroll/compact model,
  content hand-off, transitions) without regressing the documented scroll-trembling fix.
- G-3 — Define the **canonical content hierarchy** for the header across all entity
  types (what elements, what priority, optional back button).
- G-4 — Decide and specify the **token treatment** for the header surface color
  (fix/rename `--surface-warm` vs. dedicated header-surface token), covering light + dark.
- G-5 — Decide whether to **de-duplicate** the 6 entity-header compact-mode CSS blocks
  into the shared component as part of the rework.

## 4. Non-goals

- NG-1 — Not touching the homepage `HeroSection.astro` `.hero__bg-wave` (a separate,
  non-shared decorative wave). Out of scope entirely.
- NG-2 — Not a redesign of the detail page **body** (two-column article + sidebar) —
  only the header region above it.
- NG-3 — Not adding new data/fields to entities. Any new header element (e.g. back
  button) must be composed from data already available to the page.
- NG-4 — No implementation commitment in this phase. Code changes wait on the G-1
  owner decision.

## 5. Current baseline

Audited in `apps/web` on 2026-07-04. All findings below are code-verified.

### 5.1 Shared component (single source of truth)

- `apps/web/src/components/shared/ui/WaveHeader.astro` renders the wave. It is consumed
  by **two** layouts:
  - `apps/web/src/layouts/DetailLayout.astro` — `<WaveHeader paddingTop="detail">` (detail pages)
  - `apps/web/src/layouts/ListingLayout.astro` — `<WaveHeader paddingTop="listing">` (listing pages)
- **Hard constraint**: changing the wave changes listings too. Scope must decide whether
  to embrace that (rework both) or introduce a variant (see OQ-1).

### 5.2 Pages using it (via `DetailLayout` → `WaveHeader`)

| Entity | Page | Header component (`slot="page-header"`) |
|---|---|---|
| Accommodation | `pages/[lang]/alojamientos/[slug].astro` | `DetailHeader.astro` |
| Destination | `pages/[lang]/destinos/[...path].astro` | `DestinationDetailHeader.astro` |
| Event | `pages/[lang]/eventos/[slug].astro` | `EventDetailHeader.astro` |
| Blog / Post | `pages/[lang]/publicaciones/[slug].astro` | `PostDetailHeader.astro` |
| Gastronomy | `pages/[lang]/gastronomia/[slug].astro` | `GastronomyDetailHeader.astro` |
| Experience | `pages/[lang]/experiencias/[slug].astro` | `ExperienceHero.astro` |
| Attraction | `pages/[lang]/destinos/atraccion/[slug]/index.astro` | inline `<h1>` (no dedicated header) |
| Accommodation photos | `pages/[lang]/alojamientos/[slug]/fotos.astro` | uses `DetailLayout` |

### 5.3 How the wave is produced

- Inline SVG bezier path in `WaveHeader.astro`, filled with `var(--surface-warm)`:
  `<path d="M0,64 C288,120 576,0 864,64 C1152,128 1440,32 1440,32 L1440,0 L0,0 Z" .../>`.
  Not a clip-path / mask; a real filled SVG in normal flow with a negative
  `margin-bottom` in compact mode so content scrolls up behind it.
- **Color is a naming accident**: `--surface-warm` is named "warm" but defined as a pale
  blue in `packages/design-tokens/src/tokens/colors.ts` → `warm: { l: 0.95, c: 0.03, h: 250 }`
  (`oklch(0.95 0.03 250)`). Dark-mode override in `packages/design-tokens/src/themes/web-dark.ts`
  flips it to a dark navy. So the "celeste" the owner sees is this token, not a
  purpose-named header color.

### 5.4 Behavior

- Scroll-driven expand/compact toggle with **hysteresis** in `WaveHeader.astro`:
  `EXPAND_AT = 8px`, `COMPACT_AT = 96px`, via `requestAnimationFrame`-throttled scroll.
- `overflow-anchor: none` on `html:has(.wave-header)` — a documented root-cause fix for a
  scroll-trembling bug where scroll anchoring fought the compact toggle. **Preserve or
  explicitly re-derive; do not naively simplify.**
- Compact mode: breadcrumbs collapse (`max-height:0`), content padding shrinks, wave SVG
  height 80px→48px with `margin-bottom:-48px` overlap + theme-aware `drop-shadow`.
- `data-wave-padding` drives `--wave-header-padding-top` via CSS var (a SPEC-046 CSP
  `style-src-attr` fix — no inline `style`). Mobile map view pins `data-locked-compact`.
- `@media (prefers-reduced-motion: reduce)` disables transitions in the shared component
  and is mirrored in each entity header.

### 5.5 Complexity driver — duplicated compact CSS

Each of the 6 entity headers (`DetailHeader.astro`, `DestinationDetailHeader.astro`,
`EventDetailHeader.astro`, `PostDetailHeader.astro`, `GastronomyDetailHeader.astro`,
`ExperienceHero.astro`) carries its **own** `:global(.wave-header--compact) .xxx-header__main { ... }`
rules (row layout + font shrink on compact). All Astro scoped `<style>`, no CSS Modules.
Any behavioral/visual change touches all 6 in parallel unless de-duplicated (G-5 / OQ-4).

### 5.6 Content today

Header content = breadcrumbs slot + entity header (type/category badge, status pills
[featured/verified/new/cancelled/past], `<h1>` title, location link, rating stars +
review count, bookmark counter, right-aligned `FavoriteButton` React island) + decorative
wave SVG. **No back button exists in any header.**

## 6. Proposed design

The G-1 discovery is closed. The owner recorded a decision (see
`docs/G1-options-analysis.md` §0, and the OQ-6 revision below). This section is now the
**committed, junior-implementable design** (AC-2), not a menu.

> **Decision summary** (per OQ): **Opt-B "band puro"** aesthetic on both surfaces ·
> **hybrid 3-state** behavior on detail / **static band** on listing (OQ-6, revised —
> see §6.2) · **rework the single shared component** (OQ-1) · dedicated
> **`--surface-header`** token (OQ-3) · **consolidate** the per-page compact CSS while
> **preserving per-page override** (OQ-4) · **add a back button**, keep favorite in header
> (OQ-5).

### 6.1 Aesthetic — Opt-B "band puro" (both surfaces)

- **Remove the inline SVG bezier wave entirely** from `WaveHeader.astro`. No wave
  silhouette, no `d` path, no `preserveAspectRatio` SVG in normal flow.
- Replace it with a **solid band** filled by the new `--surface-header` token (a subtle
  same-hue vertical gradient is allowed but not required; if used, both stops come from
  brand tokens so dark mode stays trivially correct). Clean straight bottom edge.
- In the **compact** and **hidden** transitions, keep a **theme-aware bottom drop-shadow**
  (reuse the current `filter: drop-shadow(... var(--core-background))` technique so the
  edge reads correctly in light and dark) instead of the old wave overhang.
- The entity photo stays in the **body gallery**, never in the header (owner: no image in
  the header).
- Applies to **both** `paddingTop="detail"` and `paddingTop="listing"`.

### 6.2 Behavioral model — hybrid 3-state (detail) / static (listing)

**OQ-6 revised (2026-07-05, supersedes G-1 §0 "Beh-2 puro").** The owner chose to **keep
the compact state** (it carries real function — per-page show/hide of essentials) **and**
layer scroll-direction hide/reveal on top of it. A pure slide-out (Beh-2) would have
deleted the compact state and its per-page customization; that is explicitly rejected.

**Detail** = a 3-state machine driven by scroll position + scroll direction:

| State | Enter when | Renders |
|---|---|---|
| `expanded` | `y ≤ EXPAND_AT` (8px) | full header (back+breadcrumb, badges, big H1, location, rating, favorite) |
| `compact` | `y ≥ COMPACT_AT` (96px) **and** not sliding hidden | essentials in one row (H1 one line + favorite); each page chooses what collapses |
| `hidden` | sustained scroll **down** past a **direction dead-zone** while already `compact` | whole header translated out (max reading height) |

- **Transitions**: `expanded → compact` on downward scroll crossing `COMPACT_AT`;
  `compact → expanded` on reaching the top (`y ≤ EXPAND_AT`); `compact → hidden` on
  accumulated **downward** delta ≥ `HIDE_DELTA` (dead-zone, e.g. ~24px) — never near the
  top; `hidden → compact` on accumulated **upward** delta ≥ `REVEAL_DELTA`; `hidden →
  expanded` only via `compact` once the top is reached. Reveal always shows **compact**,
  not expanded (matches owner's model).
- **Direction dead-zone (AC-3)**: accumulate signed scroll delta; only flip the
  hidden/visible axis when the accumulator crosses the threshold; **reset the accumulator
  on direction change**. This is the anti-jitter guard for the *new* hide/reveal surface
  and MUST be verified not to re-introduce trembling.
- **Keep the existing compaction machinery**: the `EXPAND_AT`/`COMPACT_AT` hysteresis and
  the `overflow-anchor: none` fix on `html:has(.wave-header)` stay — compact still exists,
  so the trembling bug they fixed is still reachable. Do **not** remove them; the
  hide/reveal layer is *additive*.
- Keep the `requestAnimationFrame`-throttled scroll handler and the
  `astro:before-swap`/`astro:after-swap` cleanup+reinit symmetry (no duplicate listeners
  across View Transitions).
- **`data-locked-compact`** (mobile map, `mapa.astro`) must pin `compact` and **suppress
  the hidden state** entirely (the header never slides out in the locked map UX).
- **`prefers-reduced-motion: reduce`**: disable the hide/reveal layer (header never slides
  out) and keep expanded↔compact instantaneous — safest for vestibular sensitivity.

**Listing** = **static band**: no scroll JS, no compact, no hide/reveal. `WaveHeader`
renders a fixed band; the `paddingTop="listing"` path attaches none of the state machine.
Must preserve `ListingLayout`'s same-path partial-swap contract (`data-listing-swap`
attributes; header DOM node not swapped on filter navigations).

### 6.3 Content hierarchy (OQ-5)

Canonical element set + priority, shared across entity types; each entity contributes what
it has:

1. **Back button** (new) + breadcrumb — left-aligned, top row.
2. Type/category badge + status pills (featured / verified / new / cancelled / past).
3. **H1 title** — the anchor.
4. Location / destination link.
5. Rating stars + review count.
6. **Favorite button** — right-aligned React island, outside the collapsible column so it
   never moves in compact.

- **Compact default** (shared): collapse breadcrumb+back, secondary badges, location,
  rating/meta; keep H1 (one line) + favorite. Each page may **override** what it collapses
  (see §6.5).
- **Back button**: new shared `HeaderBackButton.astro`, history-aware — reuse the pattern
  in `ContributionBackLink.astro` (`history.back()` when a same-origin referrer /
  `history.state.index > 0` exists, else fall back to an `href` pointing at the entity's
  parent listing). Composed from routing only (NG-3-safe). Icon = `ArrowLeftIcon` from
  `@repo/icons`, i18n label.
- **Favorite**: unchanged — stays right-aligned in the header.

### 6.4 Token treatment (OQ-3)

- Add a dedicated **`--surface-header`** token (+ `--surface-header-foreground` if header
  text needs a paired ink), light **and** dark, and repoint **only** the header to it.
- Do **not** rename/touch `--surface-warm` (used repo-wide for section alternation — out
  of scope; note the mislabel as a separate future cleanup).
- Pipeline: add `surfaces.header` OKLCH in
  `packages/design-tokens/src/tokens/colors.ts`; map `'surface-header'` in
  `themes/web-light.ts`; add an explicit dark override in `themes/web-dark.ts` — **and if a
  foreground token is introduced, define its dark value explicitly too** (SPEC-308 lesson:
  dark mode does not re-derive a foreground from its light sibling). Regenerate
  `dist/tokens.css` via `pnpm --filter @repo/design-tokens build`; update the colocated
  `generate-css.test.ts.snap` snapshot and `themes/web.test.ts` assertions.
- **Concrete hue values are confirmed against the visual companion mockup**, not invented
  here — the token structure is fixed; the exact `l/c/h` is a design call recorded at
  implementation.

### 6.5 De-duplication (OQ-4)

Consolidate the duplicated compact-mode CSS into the shared component **while preserving
per-page override**:

- Move the common compact rules (row collapse, font shrink, hide breadcrumb/rating/meta)
  into `WaveHeader.astro` as the shared default, keyed off the existing
  `.wave-header--compact` contract.
- Keep a **per-page escape hatch** so each entity can still choose what collapses (e.g. a
  documented set of `--wave-compact-*` CSS vars or opt-in classes the entity header sets),
  because the 6 headers legitimately differ (Post also hides a summary; Destination hides
  an attractions list; Gastronomy/Experience diverge on `align-items`).
- **8 consumers** of the `.wave-header--compact` contract must stay in sync, not just 6:
  the 6 entity headers **plus** `ListingPageHeader.astro` (listing titles) **plus**
  `mapa.astro` (mobile map, locked-compact). Audit all eight when consolidating.

## 7. Data model / contracts

None expected. No entity schema/field changes (NG-3). Possible additions are limited to
design-token definitions in `packages/design-tokens` and CSS/markup in `apps/web`.

## 8. UX / UI behavior

- **Detail states**: `expanded` (top), `compact` (scrolled, essentials visible),
  `hidden` (sustained scroll-down, header slid out); reveal-on-scroll-up returns to
  `compact`, top returns to `expanded`. See §6.2 for thresholds and the direction
  dead-zone.
- **Listing**: static band, no state changes.
- **Light + dark**: band uses `--surface-header` (both themes); edge drop-shadow uses
  `--core-background` so it reads in both.
- **`prefers-reduced-motion: reduce`**: hide/reveal disabled (header stays put); any
  remaining expanded↔compact change is instantaneous.
- **Mobile vs. desktop**: same state machine; compact essentials must fit one row on
  small viewports (H1 truncates, favorite stays).
- **Locked-compact map** (`mapa.astro`): pinned to `compact`, `hidden` suppressed, no
  wave SVG (already removed).
- **Layout offsets**: the `+105px` sticky-sidebar magic number in `DetailLayout` and
  `ListingLayout` must be re-derived from the new band/compact height — prefer exposing it
  as a CSS var (the map already reads `--wave-bar-compact`) instead of a second hardcoded
  constant.

## 9. Acceptance criteria

- AC-1 ✅ — An options-and-tradeoffs doc (G-1) exists with visual references and a
  recommendation, and the owner recorded a decision (`docs/G1-options-analysis.md` §0,
  with OQ-6 revised in §6.2 of this spec).
- AC-2 ✅ — The chosen direction is specified concretely (design, behavior, content
  hierarchy, tokens) in §6 — junior-implementable.
- AC-3 — Compaction is **preserved** (hysteresis + `overflow-anchor:none` kept); the
  **new** hide/reveal layer has a direction dead-zone that is verified NOT to re-introduce
  scroll trembling before it ships.
- AC-4 — The header-surface color goes through the dedicated `--surface-header` token,
  working in both light and dark.
- AC-5 — Scope is recorded: **shared component reworked, both surfaces** (Opt-B on
  listing enables it); listing stays a static band and its partial-swap contract is
  preserved.
- AC-6 — The 3-state model works on all 6 detail entity types; the shared compact default
  is consolidated while each page's collapse override still works.
- AC-7 — All 8 `.wave-header--compact` consumers (6 headers + `ListingPageHeader` +
  `mapa.astro`) stay visually correct; the mobile map's locked-compact UX is unbroken.

## 10. Risks

- R-1 — Blast radius: the shared component + 6 duplicated CSS blocks + listing layout mean
  a "small visual tweak" is never small. Underestimating this leads to inconsistent
  half-migrations.
- R-2 — Regressing the documented scroll-trembling / `overflow-anchor` fix by simplifying
  the compact logic.
- R-3 — Opt-C (image hero) depends on every entity having a usable hero image and passing
  contrast/a11y — a hidden data + accessibility dependency.
- R-4 — Dark mode: any new color must be defined for both themes or it breaks one.
- R-5 — CSP: the SPEC-046 no-inline-`style` constraint must be respected (drive dynamic
  values through CSS vars / classes, not inline `style` attributes).

## 11. Open questions — RESOLVED

- OQ-1 — **Scope**: ✅ Rework the single shared `WaveHeader` for **both** surfaces (no
  detail-only variant). Enabled by Opt-B on listings too.
- OQ-2 — **Aesthetic**: ✅ **Opt-B "band puro"** (solid band, no wave SVG, no image),
  both surfaces.
- OQ-3 — **Token**: ✅ Dedicated **`--surface-header`** (light + dark); `--surface-warm`
  left untouched.
- OQ-4 — **De-dup**: ✅ **Consolidate** the compact CSS into the shared component while
  preserving a per-page override; audit all **8** consumers (see §6.5).
- OQ-5 — **Content**: ✅ Canonical set in §6.3; **add** a history-aware back button; keep
  favorite right-aligned in the header.
- OQ-6 — **Behavior**: ✅ **Hybrid 3-state** on detail (expanded/compact/hidden), static
  band on listing. **Revised from G-1 §0's "Beh-2 puro"** — compaction is kept, not
  removed (§6.2).

Remaining implementation-time confirmations (not blocking): exact `--surface-header`
`l/c/h` values (against the visual mockup), and the tuned `HIDE_DELTA`/`REVEAL_DELTA`
dead-zone thresholds (measured, not guessed).

## 12. Implementation notes

- All styling is Astro scoped `<style>` (no CSS Modules — those are reserved for React
  islands per `apps/web/CLAUDE.md`). CSP: drive dynamic values through CSS vars/classes,
  never inline `style` (SPEC-046, R-5).
- **Full blast radius** (verified 2026-07-05):
  - `apps/web/src/components/shared/ui/WaveHeader.astro` — remove SVG, band + 3-state JS.
  - `apps/web/src/layouts/DetailLayout.astro` + `ListingLayout.astro` — consume it; each
    hardcodes `calc(var(--navbar-height,80px) + 105px)` for the sticky sidebar → re-derive.
    `ListingLayout` also owns the `hospeda:listing-nav` partial-swap script (preserve the
    `data-listing-swap` contract).
  - The **6 entity headers** (§5.5) — consolidate their compact CSS, keep per-page override.
  - **7th consumer**: `apps/web/src/components/shared/layout/ListingPageHeader.astro` — its
    own `:global(.wave-header--compact)` block.
  - **8th consumer**: `apps/web/src/pages/[lang]/alojamientos/mapa.astro` — force-locks
    compact + hides the wave; must suppress the new `hidden` state.
  - `packages/design-tokens` — new `--surface-header` token (colors.ts + web-light.ts +
    web-dark.ts + regenerate + snapshot/test updates).
  - New shared `HeaderBackButton.astro` — model on `ContributionBackLink.astro`.
- Do not conflate with `HeroSection.astro` `.hero__bg-wave` (NG-1).

## 13. Linear

Canonical tracking:
HOS-84
