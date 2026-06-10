/**
 * @file themes/admin-dark.ts
 * @description Admin dark theme overrides for SPEC-153.
 *
 * Admin-dark primary is `river[400]` — one shade lighter than admin-light's
 * `river[500]` (raised in the brand-cohesion pass), since text must read
 * brighter on a dark background. Same pattern applies to every color-* token:
 * shift down one shade in the ladder.
 *
 * Tokens NOT listed here (`--font-body`, `--font-heading`, `--radius`)
 * are NOT overridden in dark mode — admin keeps the same fonts and
 * radius across themes.
 *
 * The CSS generator (T-153-16) emits these declarations inside
 * `[data-app="admin"][data-theme="dark"]` so they apply only when both
 * conditions hold: admin app AND dark theme attribute.
 */

import {
    type OKLCH,
    accent,
    danger,
    info,
    neutral,
    river,
    success,
    warning
} from '../tokens/colors.js';
import type { Theme } from './types.js';

/** Near-white for elevated surfaces in dark mode is wrong; use neutral[800] for cards. */
const DARK_BG_ELEVATED: OKLCH = neutral[800];

/**
 * Web dark-theme overrides for the brand tokens we expose in the admin scope.
 * Mirrored from `web-dark.ts`. Only the tokens web overrides in dark are
 * listed; the `hospeda-*` family is NOT overridden in web dark mode, so it
 * inherits the admin-light values via the cascade (matching web exactly).
 */
const WEB_DARK_BRAND_PRIMARY: OKLCH = { l: 0.68, c: 0.17, h: 259 };
const WEB_DARK_BRAND_SECONDARY: OKLCH = { l: 0.25, c: 0.05, h: 255 };
const WEB_DARK_BRAND_ACCENT: OKLCH = { l: 0.72, c: 0.19, h: 55 };
const WEB_DARK_MUTED: OKLCH = { l: 0.22, c: 0.02, h: 220 };
const WEB_DARK_INFO: OKLCH = { l: 0.68, c: 0.17, h: 259 };
const WEB_DARK_WARNING: OKLCH = { l: 0.78, c: 0.18, h: 85 };
const WEB_DARK_WARNING_FOREGROUND: OKLCH = { l: 0.1, c: 0.02, h: 85 };
const WEB_DARK_CORE_FOREGROUND: OKLCH = { l: 0.92, c: 0.01, h: 210 };

export const adminDark: Theme = {
    // ========================================================================
    // Primary (one shade LIGHTER than admin-light for dark-bg contrast)
    // ========================================================================
    'color-primary': river[400],
    'color-primary-hover': river[300],
    'color-primary-pressed': river[500],

    // ========================================================================
    // Accent
    // ========================================================================
    'color-accent': accent[500],

    // ========================================================================
    // Background / surface (dark grays; elevated sits ABOVE bg-app)
    // ========================================================================
    'color-bg-app': neutral[900],
    'color-bg-elevated': DARK_BG_ELEVATED,

    // ========================================================================
    // Foreground — inverted ladder vs light. Primary text is near-white,
    // muted is the same mid-gray (500) since neutral is achromatic.
    // ========================================================================
    'color-fg-primary': neutral[100],
    'color-fg-secondary': neutral[400],
    'color-fg-muted': neutral[500],

    // ========================================================================
    // Border (visible on dark bg — neutral[700] gives subtle 1px lines)
    // ========================================================================
    'color-border': neutral[700],

    // ========================================================================
    // Semantic feedback (one shade lighter than admin-light)
    // ========================================================================
    'color-success': success[500],
    'color-warning': warning[500],
    'color-danger': danger[500],
    'color-info': info[500],

    // ========================================================================
    // Web brand tokens — dark overrides (mirrored from `web-dark.ts`). Only
    // the tokens web overrides in dark mode are listed; `hospeda-river/sky/
    // forest/sand` inherit their admin-light values via the cascade, exactly
    // as they do in web (web dark does not redeclare the hospeda-* family).
    // ========================================================================
    'brand-primary': WEB_DARK_BRAND_PRIMARY,
    'brand-accent': WEB_DARK_BRAND_ACCENT,
    'brand-secondary': WEB_DARK_BRAND_SECONDARY,
    muted: WEB_DARK_MUTED,
    info: WEB_DARK_INFO,
    warning: WEB_DARK_WARNING,
    'warning-foreground': WEB_DARK_WARNING_FOREGROUND,
    'core-foreground': WEB_DARK_CORE_FOREGROUND
};
