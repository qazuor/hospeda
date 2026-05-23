/**
 * @file themes/admin-dark.ts
 * @description Admin dark theme overrides for SPEC-153.
 *
 * Doc 05 §6.3 prescribes admin-dark primary = `river[500]` (one shade
 * lighter than admin-light's `river[600]` since text must read brighter
 * on a dark background). Same pattern applies to every color-* token:
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

export const adminDark: Theme = {
    // ========================================================================
    // Primary (one shade LIGHTER than admin-light for dark-bg contrast)
    // ========================================================================
    'color-primary': river[500],
    'color-primary-hover': river[400],
    'color-primary-pressed': river[600],

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
    'color-info': info[500]
};
