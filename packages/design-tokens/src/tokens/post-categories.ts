/**
 * @file tokens/post-categories.ts
 * @description Per-post-category semantic color tokens.
 *
 * Layered color model (mirrors `tokens/event-categories.ts` and
 * `tokens/accommodation-types.ts`):
 *
 *   generic base palette  →  `--palette-<name>-<shade>`
 *        ↓ referenced via var()
 *   per-category semantic token  →  `--post-category-<category>`  (this module)
 *        ↓ consumed with the SAME `contrast` treatment in BOTH apps
 *   badge fill / text / border  (computed in `@repo/icons`)
 *
 * Each of the 18 post categories maps to ONE existing base palette and exposes
 * a dedicated `--post-category-<category>` token whose VALUE is a `var()`
 * reference to that palette's shade-500 primitive. No NEW base palettes are
 * introduced — categories reuse the existing brand / semantic /
 * accommodation-type palettes. The chosen palettes match the categories'
 * historical badge colors. Some categories intentionally share the same
 * palette (e.g. EVENTS and FAMILY both reference `river`) — that mirrors the
 * pre-existing config where multiple categories were assigned the same
 * `BadgeColor`. The token names remain distinct so future tuning can give
 * each its own hue without touching consumers.
 */

import type { Theme } from '../themes/types.js';

/**
 * Maps each post-category token name (lowercase slug) to the base palette it
 * draws its hue from. The value is a `var()` reference to the palette's
 * shade-500 primitive so the per-category token CONSUMES the generic.
 *
 * Category → palette assignment (matches the prior static badge colors):
 *   events → river · culture → danger · gastronomy → forest · nature → sand ·
 *   tourism → purple · general → rose · sport → river · carnival → cyan ·
 *   nightlife → teal · history → accent · traditions → neutral ·
 *   wellness → neutral · family → river · tips → danger · art → forest ·
 *   beach → sand · rural → purple · festivals → rose
 */
export const postCategoryTokens: Theme = {
    'post-category-events': 'var(--palette-river-500)',
    'post-category-culture': 'var(--palette-danger-500)',
    'post-category-gastronomy': 'var(--palette-forest-500)',
    'post-category-nature': 'var(--palette-sand-500)',
    'post-category-tourism': 'var(--palette-purple-500)',
    'post-category-general': 'var(--palette-rose-500)',
    'post-category-sport': 'var(--palette-river-500)',
    'post-category-carnival': 'var(--palette-cyan-500)',
    'post-category-nightlife': 'var(--palette-teal-500)',
    'post-category-history': 'var(--palette-accent-500)',
    'post-category-traditions': 'var(--palette-neutral-500)',
    'post-category-wellness': 'var(--palette-neutral-500)',
    'post-category-family': 'var(--palette-river-500)',
    'post-category-tips': 'var(--palette-danger-500)',
    'post-category-art': 'var(--palette-forest-500)',
    'post-category-beach': 'var(--palette-sand-500)',
    'post-category-rural': 'var(--palette-purple-500)',
    'post-category-festivals': 'var(--palette-rose-500)'
};
