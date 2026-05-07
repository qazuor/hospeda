# B-3 Horizontal Overflow Investigation (T-012)

**Date:** 2026-05-07
**URL tested:** http://localhost:4321/es/
**Tooling:** Playwright (Chromium), evaluate() in-page measurements

## Method

For each viewport, measured:

- `window.innerWidth`
- `document.documentElement.scrollWidth`
- `document.body.scrollWidth`
- `getComputedStyle(html).overflowX` and `body.overflowX`
- Real horizontal scroll attempt: `window.scrollTo(100, 0)` then read back `window.scrollX`
- Top elements with `left < innerWidth && right > innerWidth + 1` (i.e., visible-and-overflowing, excluding the off-canvas mobile drawer that has `left >= innerWidth`)

## Per-viewport results

### 320 px

| Metric | Value |
|---|---|
| innerWidth | 320 |
| html.scrollWidth | 305 |
| body.scrollWidth | 476 |
| overflowX (html / body) | clip / clip |
| scrollX after `scrollTo(100,0)` | 0 |
| hasVisibleScroll | false |

Top wide visible elements: `event-card-h` ARTICLE (w=281, right=353) — sibling slide of horizontal carousel, intentional.

### 375 px

| Metric | Value |
|---|---|
| innerWidth | 375 |
| html.scrollWidth | 360 |
| body.scrollWidth | 479 |
| overflowX (html / body) | clip / clip |
| scrollX after `scrollTo(100,0)` | 0 |
| hasVisibleScroll | false |

Top wide visible elements: `_mainSlide_11hhe_72` (w=281, left=315, right=596), `_slideCard_11hhe_101` (w=262, right=586), testimonials `_card_1h6pt_3` FIGURE (w=224, right=567). All are next/prev carousel slides positioned for transitions, contained by a clipping wrapper.

### 414 px

| Metric | Value |
|---|---|
| innerWidth | 414 |
| html.scrollWidth | 399 |
| body.scrollWidth | 481 |
| overflowX (html / body) | clip / clip |
| scrollX after `scrollTo(100,0)` | 0 |
| hasVisibleScroll | false |

Top wide visible elements: same testimonial/main-slide carousel siblings.

### 768 px

| Metric | Value |
|---|---|
| innerWidth | 768 |
| html.scrollWidth | 753 |
| body.scrollWidth | 766 |
| overflowX (html / body) | clip / clip |
| scrollX after `scrollTo(100,0)` | 0 |
| hasVisibleScroll | false |

Top wide visible elements: 2 SVG `path` nodes (decorative, contained), inside SVGs that themselves do not overflow.

## Note on the off-canvas mobile drawer

At every viewport the top of the "elements wider than viewport" list is dominated by mobile-drawer descendants whose `left == innerWidth` (i.e., translated fully off-canvas):

```
_overlay_hwupm_3     left=vw, right=2*vw
_header_hwupm_21     left=vw, right=2*vw
_nav_hwupm_58        left=vw, right=2*vw
_authSection_hwupm_128
_preferencesSection_hwupm_292
_footer_hwupm_95
```

These are intentionally rendered off-canvas (transform/translate or position offset) so the drawer is positioned for slide-in animation. They are NOT actual overflow because their left edge is at the right edge of the viewport, and they sit inside an `overflow: clip` ancestor. Filtering them out (left < vw) is required for any honest overflow audit.

## Conclusion

**ARTIFACT ONLY** — at all four viewports (320, 375, 414, 768):

1. `window.scrollX` remains 0 after a horizontal scroll attempt → no visible horizontal scroll exists.
2. `html.scrollWidth` is actually LESS than `innerWidth` at every viewport (the gap is the scrollbar gutter).
3. `body.scrollWidth > innerWidth` at narrow viewports, BUT both `html` and `body` have `overflow-x: clip` — so overflowing content is hidden, not scrollable.
4. The originally-reported numbers (99px @ 375, 13px @ 768, 151px @ 320) almost certainly came from raw `scrollWidth - innerWidth` arithmetic that ignored the active `overflow-x: clip` wrapping. With `clip`, the browser still reports the natural content size in `scrollWidth` even though no scroll occurs.

**The audit tooling's overflow check is the bug, not the layout.** A correct check must read `getComputedStyle(html).overflowX` and `getComputedStyle(body).overflowX`, and treat `clip` (or `hidden`) as "not a real overflow."

## Recommended action (T-013)

Add a comment block to `apps/web/src/styles/global.css` above the `html, body { overflow-x: clip }` rule documenting this artifact, so future audits don't re-flag this as a regression. No layout changes required.

## Files inspected

- `apps/web/src/styles/global.css`
- `apps/web/src/components/sections/HeroSection.astro`
- `apps/web/src/components/sections/AboutUsSection.astro` (no measurement deltas vs baseline)
