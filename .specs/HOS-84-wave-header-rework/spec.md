---
title: Wave Header Rework (Detail & Listing Pages)
linear: HOS-84
statusSource: linear
status: draft-exploration
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

Discovery-first: this section is a **menu of options to evaluate**, not a committed
design. The G-1 deliverable turns the chosen aesthetic option into a concrete design.

### 6.1 Aesthetic direction (owner is open to replacement) — options to compare

- **Opt-A — Keep & restyle the wave.** Refine silhouette (edit SVG `d`), fix the color
  token, tune compact shadow. Lowest risk, preserves brand recognition. Con: if the wave
  itself is the problem, this only mitigates.
- **Opt-B — Solid / gradient band.** Drop the wave for a flat or gradient surface with a
  clean bottom edge. Modern, cheap to make premium, simplest behavior. Con: loses the
  wave as a brand motif.
- **Opt-C — Image hero.** Use the entity's own hero image as the header background with an
  overlay for legibility. Highest "premium" ceiling, strongest storytelling. Con: needs a
  guaranteed image per entity + contrast/a11y handling; heaviest change.
- **Opt-D — Hybrid.** Image/gradient band with a subtler wave edge retained as accent.

Each option must be assessed against: brand fit, premium feel, dark-mode, a11y/contrast,
behavioral complexity, and blast radius (listings + 6 headers).

### 6.2 Behavioral model

Specify the target scroll/compact behavior (or removal of compaction) and confirm it
either keeps the hysteresis + `overflow-anchor:none` fix or replaces it with an
equivalent that is verified not to re-introduce scroll trembling.

### 6.3 Content hierarchy

Define a canonical header element set + priority order shared across entity types, mapping
which elements each entity contributes, and decide on a back button.

### 6.4 Token treatment

Either rename/fix `--surface-warm` to reflect its real hue, or introduce a dedicated
`--surface-header` (or similar) token with explicit light + dark values, and repoint the
component to it.

### 6.5 De-duplication

Decide whether the 6 duplicated compact-mode blocks fold into the shared component
(single source of behavior) as part of the rework.

## 7. Data model / contracts

None expected. No entity schema/field changes (NG-3). Possible additions are limited to
design-token definitions in `packages/design-tokens` and CSS/markup in `apps/web`.

## 8. UX / UI behavior

To be finalized after the G-1 decision. Must cover: expanded vs. compact states (if
compaction survives), light + dark themes, `prefers-reduced-motion`, mobile vs. desktop,
and the locked-compact map case.

## 9. Acceptance criteria

- AC-1 — An options-and-tradeoffs doc (G-1) exists with visual references and a
  recommendation, and the owner has recorded a decision on the aesthetic direction.
- AC-2 — The chosen direction is specified concretely enough for a junior to implement
  (design, behavior, content hierarchy, tokens) before any code is written.
- AC-3 — The scroll-trembling fix is either preserved or explicitly re-derived and
  verified in the new behavioral model.
- AC-4 — The header-surface color goes through a correctly-named design token, working in
  both light and dark.
- AC-5 — Scope decision (detail-only vs. shared/listings) is recorded, and the listing
  impact is accounted for either way.

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

## 11. Open questions

- OQ-1 — **Scope**: rework only detail pages, or the shared `WaveHeader` (listings
  included, unavoidably)? Or introduce a detail-only variant of the shared component?
- OQ-2 — **Aesthetic**: which of Opt-A/B/C/D (or a mix)? (Gates everything — G-1.)
- OQ-3 — **Token**: fix/rename `--surface-warm`, or add a dedicated header-surface token?
- OQ-4 — **De-dup**: fold the 6 entity-header compact CSS blocks into the shared
  component, or leave them?
- OQ-5 — **Content**: canonical header element set + priority across entities; add a back
  button? Keep the favorite button in the header or relocate it?
- OQ-6 — **Behavior**: keep scroll compaction at all, or is a static header preferable?

## 12. Implementation notes

- The wave is a static inline SVG path; silhouette changes = editing the `d` attribute in
  `WaveHeader.astro`.
- All styling is Astro scoped `<style>` (no CSS Modules — those are reserved for React
  islands per `apps/web/CLAUDE.md`).
- Files in the blast radius: `WaveHeader.astro`, `DetailLayout.astro`,
  `ListingLayout.astro`, the 6 entity headers listed in §5.5, plus
  `packages/design-tokens` for the color token.
- Do not conflate with `HeroSection.astro` `.hero__bg-wave` (NG-1).
- `status: draft-exploration` in this frontmatter — no worktree is created until an
  implementation direction is chosen.

## 13. Linear

Canonical tracking:
HOS-84
