/**
 * @file tokens/auth-providers.ts
 * @description Per-auth-provider semantic color tokens.
 *
 * Layered color model (mirrors user-roles / accommodation-types /
 * event-categories / post-categories):
 *
 *   generic base palette  →  `--palette-<name>-<shade>`
 *        ↓ referenced via var()
 *   per-provider semantic token  →  `--auth-provider-<provider>`
 *        ↓ consumed in BOTH apps via the SSOT in `@repo/icons`
 *
 * Each of the 5 auth providers maps to ONE existing base palette and exposes
 * a dedicated `--auth-provider-<provider>` token whose VALUE is a `var()`
 * reference to that palette's shade-500 primitive. No NEW base palettes are
 * introduced. LOCAL and GITHUB both map to `neutral` — the dedicated brand
 * icons (Lock vs GitHub logo) carry the visual differentiation, while the
 * token names stay distinct so future tuning can give each its own hue
 * without touching consumers.
 */

import type { Theme } from '../themes/types.js';

/**
 * Provider → palette assignment:
 *   local → neutral · google → danger (brand red) · facebook → river (brand blue) ·
 *   github → neutral (brand monochrome) · better_auth → teal (modern email link)
 */
export const authProviderTokens: Theme = {
    'auth-provider-local': 'var(--palette-neutral-500)',
    'auth-provider-google': 'var(--palette-danger-500)',
    'auth-provider-facebook': 'var(--palette-river-500)',
    'auth-provider-github': 'var(--palette-neutral-500)',
    'auth-provider-better-auth': 'var(--palette-teal-500)'
};
