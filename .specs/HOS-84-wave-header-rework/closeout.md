---
title: Wave Header Rework — Closeout
linear: HOS-84
status: implemented
closed: 2026-07-05
---

# HOS-84 Wave Header Rework — Closeout

## What shipped

The celeste "wave SVG" header on public detail + listing pages was replaced with a
solid **`--surface-header` band** ("Opt-B band puro"), and a shared, testable
**3-state scroll model** (expanded / compact / hidden) was built for detail pages,
with a static-but-compacting band on listings and a locked-compact band on the map.
All 8 `.wave-header--compact` consumers were migrated to a single shared
utility-class contract, and a history-aware back button was added to the header.

Branch: `feat/hos-84-wave-header-rework` (base `origin/staging`).

## Acceptance criteria

| AC | Status | Notes |
|----|--------|-------|
| AC-1 — options + owner decision | ✅ | `docs/G1-options-analysis.md` §0; OQ-6 revised in `spec.md` §6.2. |
| AC-2 — concrete, junior-implementable design | ✅ | `spec.md` §6. |
| AC-3 — compaction preserved + hide/reveal dead-zone verified no-trembling | ✅ | `overflow-anchor:none` + hysteresis kept; direction dead-zone in `waveHeaderState.ts` (accumulator resets on direction flip); verified live via Playwright — compact holds stable through the whole scroll-up, no oscillation. |
| AC-4 — `--surface-header` token, light + dark | ✅ | New token in `packages/design-tokens` (light `oklch(0.95 0.03 250)`, dark `oklch(0.255 0.035 258)`), plus paired `--surface-header-foreground`. |
| AC-5 — shared component reworked, both surfaces; listing static + partial-swap preserved | ✅ | Single `WaveHeader.astro` reworked; listing attaches no state machine, keeps `data-listing-swap` contract. |
| AC-6 — 3-state on all 6 detail types; shared compact default + per-page override | ✅ | 6 headers migrated to `wh-compact-*` contract; per-page overrides preserved (Post hides summary+engagement, etc.). |
| AC-7 — all 8 consumers visually correct; map locked-compact unbroken | ✅ | 6 headers + `ListingPageHeader` + `mapa.astro`; map verified locked-compact (never hidden). |

## Final tuned values

Recalibrated after live owner review (the initial compact window was too short —
compact "casi no se veía"). Owner chose to keep the 3-state model but widen the
compact window (not remove `hidden`).

**State machine** (`apps/web/src/components/shared/ui/waveHeaderState.ts`, `DEFAULT_WAVE_HEADER_CONFIG`):

| Threshold | Value | Meaning |
|-----------|-------|---------|
| `EXPAND_AT` | `0` | Expand only at the true top. |
| `COMPACT_AT` | `64` | Compact once scrolled 64px down. |
| `HIDE_DELTA` | `280` | Accumulated downward scroll before hiding (~215px compact-visible window). |
| `REVEAL_DELTA` | `24` | Accumulated upward scroll to reveal `compact` from `hidden`. |

**Animation** (`WaveHeader.astro`): centralized in a heritable CSS var on `.wave-header`
so the whole header's motion is a one-line change; the entity headers inherit it via the slot.

- `--wave-header-anim-duration: 0.45s`
- `--wave-header-anim-ease: ease-in-out`

**Token** (`packages/design-tokens`): `--surface-header` light `oklch(0.95 0.03 250)` /
dark `oklch(0.255 0.035 258)`; foreground light `oklch(0.35 0.03 250)` / dark
`oklch(0.92 0.01 210)`. Sidebar sticky offset re-derived from `--wave-bar-compact`
instead of the old hardcoded `+105px`.

## Verification

- Typecheck (web) clean; biome + `check-tokens` + `check:relative-colors` green.
- Unit: `waveHeaderState.test.ts` 20/20 (rewritten to derive from config, robust to
  threshold changes).
- Component/page tests: `DetailHeader.test.ts`, `HeaderBackButton.test.ts`,
  `publicaciones-detail-media.test.ts` green (updated to the shared `wh-compact-*` contract).
- Live Playwright smoke: all 6 detail types (3-state), listing (static→compact, never
  hides), map (locked-compact), dark mode (band + theme-aware shadow), mobile 375px.
  Console errors during smoke are all pre-existing `401/429` on `/users/me/entitlements`
  (guest + map marker request amplification) — none from this change.

## Follow-ups (deferred pulido, owner-approved)

1. **Propagate `--wave-header-anim-duration`** into the 6 entity headers' own compact
   transitions — title/badges still animate at a hardcoded `0.3s`, a minor desync the
   owner accepted for now. Purely a consistency polish; the shared band already uses the var.
2. **Calibrate `--surface-header` hue** against the visual mockup — current `l/c/h` are
   documented placeholders (both themes), noted as such in `web-dark.ts`.
3. **`--surface-warm` mislabel cleanup** — the token is named "warm" but is a pale blue
   (`spec.md` §5.3). Left untouched per OQ-3; a separate future cleanup.

## Pre-PR code review (fresh context)

A fresh-context review of the full diff was run before the PR. One **High** was fixed
before merge; the rest are non-blocking and recorded here:

- **[FIXED] High — collapsed header elements stayed keyboard-focusable in compact.**
  `wh-compact-hide` only hid them visually; the new back button was focusable-but-invisible
  and announced to screen readers on all 6 detail pages. Fixed by toggling `inert` on the
  collapsed elements (and the whole bar when `hidden`) from the state machine's `apply()`
  in `WaveHeader.astro`. Verified live: back-button container `inert` in compact/hidden,
  not in expanded. Commit `d42379da1`.
- **Medium — `EXPAND_AT=0`** removes the small margin back to `expanded`; confirm on real
  mobile Safari/Chrome (URL-bar collapse / rubber-banding) that the header doesn't get
  stuck in compact near the top. Deliberate owner tuning; validate in the mobile smoke.
- **Medium — `ListingLayout` fires synthetic `astro:after-swap`** on filter partial-swaps;
  `WaveHeader.astro` re-init is a no-op only thanks to the `waveInitialized` guard. Implicit
  cross-file coupling — document or make it explicit before either side is "simplified".
- **Medium — `mapa.astro` writes `--compact`/`lockedCompact` directly**, independent of the
  state machine's `state` closure (two writers of the same visual state). Harmless today.
- **Low — `--surface-header-foreground` token is defined but unused** (headers use
  `--core-foreground`). Wire it where contrast vs `--surface-header` matters, or drop (YAGNI).
- **Low — `EventDetailHeader` `.event-header__meta` uses `max-height:12em`** vs 3-6em on
  siblings; visual-check longer `en`/`pt` date strings on narrow viewports.

## Implementation notes / decisions

- `WaveHeader.astro` uses a theme-adaptive `oklch(from var(--core-foreground) l c h / 0.18)`
  drop-shadow for the compact bottom edge; allowlisted in
  `apps/web/scripts/check-css-relative-colors.cjs` (no precomputed foreground-alpha token
  exists — same residual pattern as PartnerCard/SubscriptionDashboard).
- The compact collapse contract (`max-height:0`) lives once in `WaveHeader.astro`
  (`.wh-compact-hide`); entity headers opt in per element instead of each redefining the rule.
