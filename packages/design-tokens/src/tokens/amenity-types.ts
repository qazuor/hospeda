/**
 * @file tokens/amenity-types.ts
 * @description Per-amenity-type semantic color tokens.
 *
 * Layered color model (mirrors accommodation-types / event-categories /
 * post-categories / user-roles / auth-providers):
 *
 *   generic base palette  →  `--palette-<name>-<shade>`
 *        ↓ referenced via var()
 *   per-type semantic token  →  `--amenity-type-<type>`
 *        ↓ consumed in BOTH apps via the SSOT in `@repo/icons`
 *
 * Each of the 12 `AmenitiesTypeEnum` values maps to ONE existing base palette
 * and exposes a dedicated `--amenity-type-<type>` token whose VALUE is a
 * `var()` reference to that palette's shade-500 primitive. No NEW base
 * palettes are introduced.
 */

import type { Theme } from '../themes/types.js';

/**
 * Type → palette assignment for the 12 amenity-type categories.
 * Slug naming uses kebab-case for tokens (e.g. `bed-and-bath`).
 */
export const amenityTypeTokens: Theme = {
    'amenity-type-climate-control': 'var(--palette-cyan-500)',
    'amenity-type-connectivity': 'var(--palette-river-500)',
    'amenity-type-entertainment': 'var(--palette-purple-500)',
    'amenity-type-kitchen': 'var(--palette-terracotta-500)',
    'amenity-type-bed-and-bath': 'var(--palette-sky-500)',
    'amenity-type-outdoors': 'var(--palette-forest-500)',
    'amenity-type-accessibility': 'var(--palette-success-500)',
    'amenity-type-services': 'var(--palette-accent-500)',
    'amenity-type-safety': 'var(--palette-danger-500)',
    'amenity-type-family-friendly': 'var(--palette-rose-500)',
    'amenity-type-work-friendly': 'var(--palette-sand-500)',
    'amenity-type-general-appliances': 'var(--palette-neutral-500)'
};
