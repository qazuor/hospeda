/**
 * @file tokens/sponsor-types.ts
 * @description Per-sponsor-type semantic color tokens.
 *
 * Layered color model (mirrors accommodation-types / amenity-types /
 * event-categories / post-categories / user-roles / auth-providers):
 *
 *   generic base palette  →  `--palette-<name>-<shade>`
 *        ↓ referenced via var()
 *   per-type semantic token  →  `--sponsor-type-<type>`
 *        ↓ consumed in BOTH apps via the SSOT in `@repo/icons`
 *
 * Each of the 3 `ClientTypeEnum` values used for sponsors maps to ONE
 * existing base palette. Palettes stay close to the prior badge colors so
 * visual memory carries over.
 */

import type { Theme } from '../themes/types.js';

/**
 * Type → palette assignment:
 *   post-sponsor → river (blue) · advertiser → forest (green) · host → purple
 */
export const sponsorTypeTokens: Theme = {
    'sponsor-type-post-sponsor': 'var(--palette-river-500)',
    'sponsor-type-advertiser': 'var(--palette-forest-500)',
    'sponsor-type-host': 'var(--palette-purple-500)'
};
