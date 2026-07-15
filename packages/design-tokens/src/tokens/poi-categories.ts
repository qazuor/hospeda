/**
 * @file tokens/poi-categories.ts
 * @description Per-POI-category-bucket semantic color tokens.
 *
 * Layered color model (mirrors `tokens/event-categories.ts`):
 *
 *   generic base palette  →  `--palette-<name>-<shade>`  (theme-independent
 *                            primitives, emitted once in `:root`)
 *        ↓ referenced via var()
 *   per-bucket semantic token  →  `--poi-category-<bucket>` (+ `-on`)
 *        ↓ consumed by the category → bucket map in `@repo/icons`
 *   marker fill / grid glyph color  (resolved in `@repo/icons`)
 *
 * Unlike event categories, POI categories do NOT map 1:1 to a token. The seed
 * catalog has 40 categories (`packages/seed/src/data/poiCategory/`) and 40 hues
 * would be indistinguishable on a map and impossible to contrast-check; the
 * categories are therefore grouped into 6 BUCKETS, and the bucket carries the
 * hue. `@repo/icons`' `poi-category` module owns the category → bucket
 * assignment; this module only defines what each bucket looks like.
 *
 * ## Why these shades, and why not all -500 (HOS-182)
 *
 * Each bucket reuses the same PALETTE FAMILY its event-category counterpart uses
 * (nature→forest, culture→sand, food→rose, leisure→accent, services→neutral), so
 * a "gastronomy" POI and a "gastronomy" event stay recognisably the same thing.
 * The SHADE differs, and deliberately: an event badge sits on a card, but a POI
 * marker sits on a MAP and must clear 3:1 against BOTH the light and the dark
 * card surface. That is only satisfiable in a narrow luminance band — too light
 * and it washes out on white, too dark and it disappears on dark navy.
 *
 * Measured contrast at these shades (fill vs white / vs dark card / glyph on
 * fill), all ≥ 3:1 except `leisure` at 2.91 on dark, which is accepted: the hue
 * is a redundant channel (the glyph SHAPE carries the category, and the pin is
 * additionally distinguished by size and fill-vs-outline), so WCAG 1.4.11 does
 * not bind it.
 *
 *   water    river-500    3.56 / 4.17 / 3.30
 *   nature   forest-400   3.76 / 3.95 / 3.47
 *   culture  sand-600     4.96 / 3.00 / 4.59
 *   food     rose-500     3.96 / 3.75 / 3.40
 *   leisure  accent-600   5.10 / 2.91 / 4.41
 *   services neutral-500  4.88 / 3.05 / 4.68
 *
 * The 6 buckets stay perceptually separable: the closest pair (culture↔leisure)
 * measures ΔE ≈ 27, well past the ~10 where hues read as distinct.
 *
 * ## Why plain var() and no relative color
 *
 * Both the fill and its `-on` companion are plain `var()` references to palette
 * primitives — deliberately NOT `oklch(from ...)` expressions. Chrome 109 does
 * not support relative color (the whole reason `generators/variant-tokens-domain.ts`
 * precomputes sRGB fallbacks), and unlike an `oklch(from ...)` badge background
 * that merely renders wrong, a failed marker fill would leave the destination map
 * covered in transparent/black pins. The `-on` value is the palette's own shade-50
 * — a near-white already tinted with the bucket's hue.
 *
 * These tokens are theme-INDEPENDENT (same palette primitive across light/dark
 * and web/admin), so a bucket renders with an identical hue everywhere. They are
 * declared ONCE here and spread into both the `web-light` and `admin-light` theme
 * records (dark themes inherit via the cascade).
 */

import type { Theme } from '../themes/types.js';

/**
 * Maps each POI-category-bucket token to the base palette shade it draws its hue
 * from, plus the `-on` companion used for a glyph drawn ON TOP of that fill.
 * Values are `var()` references so the per-bucket token CONSUMES the generic
 * primitive rather than copying its OKLCH triple.
 */
export const poiCategoryTokens: Theme = {
    'poi-category-water': 'var(--palette-river-500)',
    'poi-category-water-on': 'var(--palette-river-50)',
    'poi-category-nature': 'var(--palette-forest-400)',
    'poi-category-nature-on': 'var(--palette-forest-50)',
    'poi-category-culture': 'var(--palette-sand-600)',
    'poi-category-culture-on': 'var(--palette-sand-50)',
    'poi-category-food': 'var(--palette-rose-500)',
    'poi-category-food-on': 'var(--palette-rose-50)',
    'poi-category-leisure': 'var(--palette-accent-600)',
    'poi-category-leisure-on': 'var(--palette-accent-50)',
    'poi-category-services': 'var(--palette-neutral-500)',
    'poi-category-services-on': 'var(--palette-neutral-50)'
};
