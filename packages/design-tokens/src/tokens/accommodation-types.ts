/**
 * @file tokens/accommodation-types.ts
 * @description Per-accommodation-type semantic color tokens.
 *
 * Layered color model:
 *
 *   generic base palette  →  `--palette-<name>-<shade>`  (theme-independent
 *                            primitives, emitted once in `:root`)
 *        ↓ referenced via var()
 *   per-type semantic token  →  `--accommodation-type-<type>`  (this module)
 *        ↓ consumed with the SAME `contrast` treatment in BOTH apps
 *   badge fill / text / border  (computed in `@repo/icons`)
 *
 * Each of the 10 accommodation types maps to ONE base palette and exposes a
 * dedicated `--accommodation-type-<type>` token whose VALUE is a `var()`
 * reference to that palette's shade-500 primitive. The reference (not a
 * copied OKLCH value) is what makes the layering real: re-tune a palette's
 * canonical and every consumer follows automatically.
 *
 * The token name uses the kebab-cased type slug — `country_house` becomes
 * `accommodation-type-country-house`.
 *
 * These tokens are theme-INDEPENDENT: they resolve to the same palette
 * primitive regardless of light/dark or web/admin scope, because the
 * `--palette-*` primitives they reference are emitted once in `:root` and
 * never overridden. That is exactly why a given accommodation type renders
 * with an identical hue across web-light, web-dark, admin-light and
 * admin-dark. They are therefore declared ONCE here and spread into both the
 * `web-light` and `admin-light` theme records (the dark themes inherit them
 * via the cascade), avoiding 4x duplication.
 */

import type { Theme } from '../themes/types.js';

/**
 * Maps each accommodation-type token name (kebab-case slug) to the base
 * palette it draws its hue from. The value is a `var()` reference to the
 * palette's shade-500 primitive so the per-type token CONSUMES the generic
 * rather than copying its OKLCH triple.
 *
 * Type → palette assignment (product-owner approved):
 *   hotel → accent · apartment → river · house → forest ·
 *   country_house → teal · cabin → terracotta · camping → sand ·
 *   hostel → cyan · room → rose · motel → danger · resort → purple
 */
export const accommodationTypeTokens: Theme = {
    'accommodation-type-hotel': 'var(--palette-accent-500)',
    'accommodation-type-apartment': 'var(--palette-river-500)',
    'accommodation-type-house': 'var(--palette-forest-500)',
    'accommodation-type-country-house': 'var(--palette-teal-500)',
    'accommodation-type-cabin': 'var(--palette-terracotta-500)',
    'accommodation-type-camping': 'var(--palette-sand-500)',
    'accommodation-type-hostel': 'var(--palette-cyan-500)',
    'accommodation-type-room': 'var(--palette-rose-500)',
    'accommodation-type-motel': 'var(--palette-danger-500)',
    'accommodation-type-resort': 'var(--palette-purple-500)'
};
