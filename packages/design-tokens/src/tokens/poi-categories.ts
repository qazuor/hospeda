/**
 * @file tokens/poi-categories.ts
 * @description Per-POI-category-bucket semantic color tokens.
 *
 * Layered color model (mirrors `tokens/event-categories.ts`):
 *
 *   generic base palette  →  `--palette-<name>-<shade>`  (theme-independent
 *                            primitives, emitted once in `:root`)
 *        ↓ referenced via var()
 *   per-bucket semantic token  →  `--poi-category-<bucket>`  (this module)
 *        ↓ consumed by the category → bucket map in `@repo/icons`
 *   marker fill / grid glyph color  (computed in `@repo/icons`)
 *
 * Unlike event categories, POI categories do NOT map 1:1 to a token. The seed
 * catalog has 40 categories (`packages/seed/src/data/poiCategory/`) and 40 hues
 * would be indistinguishable on a map and impossible to contrast-check; the
 * categories are therefore grouped into 6 BUCKETS, and the bucket carries the
 * hue. `@repo/icons`' `poi-category` module owns the category → bucket
 * assignment; this module only defines what each bucket looks like.
 *
 * No NEW base palettes are introduced: each bucket references an existing
 * palette's shade-500 primitive, deliberately reusing the hue that other
 * entities already use for the same concept (nature→forest, culture→sand,
 * food→rose, leisure→accent, services→neutral all match
 * `event-category-*`), so a "gastronomy" POI and a "gastronomy" event read as
 * the same thing across the platform.
 *
 * These tokens are theme-INDEPENDENT (same palette primitive across
 * light/dark and web/admin), so a bucket renders with an identical hue
 * everywhere. They are declared ONCE here and spread into both the `web-light`
 * and `admin-light` theme records (dark themes inherit via the cascade).
 */

import type { Theme } from '../themes/types.js';

/**
 * Maps each POI-category-bucket token name to the base palette it draws its hue
 * from. The value is a `var()` reference to the palette's shade-500 primitive so
 * the per-bucket token CONSUMES the generic rather than copying its OKLCH triple.
 *
 * Bucket → palette assignment:
 *   water → river · nature → forest · culture → sand · food → rose ·
 *   leisure → accent · services → neutral
 */
export const poiCategoryTokens: Theme = {
    'poi-category-water': 'var(--palette-river-500)',
    'poi-category-nature': 'var(--palette-forest-500)',
    'poi-category-culture': 'var(--palette-sand-500)',
    'poi-category-food': 'var(--palette-rose-500)',
    'poi-category-leisure': 'var(--palette-accent-500)',
    'poi-category-services': 'var(--palette-neutral-500)'
};
