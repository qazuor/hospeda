/**
 * @file tokens/event-categories.ts
 * @description Per-event-category semantic color tokens.
 *
 * Layered color model (mirrors `tokens/accommodation-types.ts`):
 *
 *   generic base palette  →  `--palette-<name>-<shade>`  (theme-independent
 *                            primitives, emitted once in `:root`)
 *        ↓ referenced via var()
 *   per-category semantic token  →  `--event-category-<category>`  (this module)
 *        ↓ consumed with the SAME `contrast` treatment in BOTH apps
 *   badge fill / text / border  (computed in `@repo/icons`)
 *
 * Each of the 8 event categories maps to ONE existing base palette and exposes
 * a dedicated `--event-category-<category>` token whose VALUE is a `var()`
 * reference to that palette's shade-500 primitive. Unlike accommodation types,
 * no NEW base palettes are introduced: every category's hue already exists in
 * the brand / semantic / accommodation-type palette families, so the tokens
 * simply reference them. The chosen hues match the categories' historical
 * badge colors (culture→yellow, sports→orange, festival→purple, …).
 *
 * These tokens are theme-INDEPENDENT (same palette primitive across
 * light/dark and web/admin), so a category renders with an identical hue
 * everywhere. They are declared ONCE here and spread into both the `web-light`
 * and `admin-light` theme records (dark themes inherit via the cascade).
 */

import type { Theme } from '../themes/types.js';

/**
 * Maps each event-category token name (lowercase slug) to the base palette it
 * draws its hue from. The value is a `var()` reference to the palette's
 * shade-500 primitive so the per-category token CONSUMES the generic rather
 * than copying its OKLCH triple.
 *
 * Category → palette assignment (matches the prior static badge colors):
 *   culture → sand · sports → accent · festival → purple · workshop → cyan ·
 *   music → river · gastronomy → rose · nature → forest · other → neutral
 */
export const eventCategoryTokens: Theme = {
    'event-category-culture': 'var(--palette-sand-500)',
    'event-category-sports': 'var(--palette-accent-500)',
    'event-category-festival': 'var(--palette-purple-500)',
    'event-category-workshop': 'var(--palette-cyan-500)',
    'event-category-music': 'var(--palette-river-500)',
    'event-category-gastronomy': 'var(--palette-rose-500)',
    'event-category-nature': 'var(--palette-forest-500)',
    'event-category-other': 'var(--palette-neutral-500)'
};
