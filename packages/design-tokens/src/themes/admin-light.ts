/**
 * @file themes/admin-light.ts
 * @description Admin light theme mapping for SPEC-153.
 *
 * Doc 05 §6.2 prescribes a clean, conventional CSS var scheme for the
 * admin app — distinct from web's hand-tuned `--brand-primary`,
 * `--core-background`, etc. (which encode marketing-specific design
 * decisions). Admin gets:
 *
 *   - `--color-primary` / `-hover` / `-pressed`
 *   - `--color-accent`
 *   - `--color-bg-app` / `-elevated`
 *   - `--color-fg-primary` / `-secondary` / `-muted`
 *   - `--color-border`
 *   - `--color-success` / `-warning` / `-danger` / `-info`
 *   - `--font-body` / `-heading`
 *   - `--radius`
 *
 * Total: ~17 entries. Admin's Tailwind v4 `@theme inline { }` block
 * (T-153-26) will map shadcn semantic names (`--background`,
 * `--primary`, etc.) back to these — keeping the package's API
 * narrow and migration changes additive on the admin side.
 *
 * Key shade-selection differences from web (per doc 05 §3 Eje 3):
 *
 *   - Primary uses `river[500]` (same as web): the brand-cohesion pass nudged
 *     this up from the original muted `river[600]` so the river blue reads as
 *     a prominent brand marker across buttons, active nav, focus and links —
 *     paired with the calmer river-tinted background it stays workspace-friendly.
 *   - Accent uses `accent[600]` (vs web's [500]): muted reasoning retained.
 *   - Background uses a faintly river-tinted off-white (`RIVER_TINTED_BG`).
 *     This is a deliberate compromise: SPEC-153 originally used `neutral[100]`
 *     (pure gray "workspace" tone), but to bring the admin closer to web's
 *     brand feel we nudge it toward web's river-white — while staying calmer
 *     than web's full `oklch(0.985 0.002 210)` (lower lightness, very low
 *     chroma) so long working sessions over tables/forms stay comfortable.
 *   - Semantic feedback colors (success/warning/danger/info) all use
 *     `[600]` shades for the same muted-density principle.
 *
 * The CSS generator (T-153-16) emits these declarations inside
 * `[data-app="admin"]` so they apply only to pages that opt in by
 * setting `data-app="admin"` on `<html>` (admin's root layout — done
 * in Phase 3 T-153-25).
 */

import { accommodationTypeTokens } from '../tokens/accommodation-types.js';
import {
    type OKLCH,
    accent,
    brandSecondary,
    danger,
    forest,
    info,
    neutral,
    river,
    sand,
    sky,
    success,
    warning
} from '../tokens/colors.js';
import { eventCategoryTokens } from '../tokens/event-categories.js';
import { postCategoryTokens } from '../tokens/post-categories.js';
import { radiusBase } from '../tokens/radius.js';
import { fontFamily } from '../tokens/typography.js';
import type { Theme } from './types.js';

/** White surface for elevated UI (cards, modals) — not part of neutral. */
const PURE_WHITE: OKLCH = { l: 1, c: 0, h: 0 };

/**
 * Hand-tuned web token values that don't map to a palette shade (mirrored from
 * `web-light.ts`). Re-declared here so the admin scope can render the
 * accommodation-type badge with the EXACT same colors web uses.
 */
const WEB_MUTED: OKLCH = { l: 0.95, c: 0.01, h: 210 };
const WEB_CORE_FOREGROUND: OKLCH = { l: 0.2, c: 0.02, h: 220 };
const WEB_WARNING_FOREGROUND: OKLCH = { l: 0.2, c: 0.02, h: 85 };

/**
 * App background: a faintly river-tinted off-white (river hue 259, matching the
 * primary). Brighter and warmer than the old neutral[100] gray, but calmer than
 * web's full river-white — the brand-cohesion-vs-workspace-ergonomics compromise.
 */
const RIVER_TINTED_BG: OKLCH = { l: 0.97, c: 0.006, h: 259 };

export const adminLight: Theme = {
    // ========================================================================
    // Primary (river — same shade as web [500] for a prominent brand marker;
    // brand-cohesion pass raised it from the original muted [600])
    // ========================================================================
    'color-primary': river[500],
    'color-primary-hover': river[400],
    'color-primary-pressed': river[600],

    // ========================================================================
    // Accent (orange — slightly muted vs web)
    // ========================================================================
    'color-accent': accent[600],

    // ========================================================================
    // Background / surface (faintly river-tinted off-white — see RIVER_TINTED_BG)
    // ========================================================================
    'color-bg-app': RIVER_TINTED_BG,
    'color-bg-elevated': PURE_WHITE,

    // ========================================================================
    // Foreground (text)
    // ========================================================================
    'color-fg-primary': neutral[900],
    'color-fg-secondary': neutral[700],
    'color-fg-muted': neutral[500],

    // ========================================================================
    // Border
    // ========================================================================
    'color-border': neutral[200],

    // ========================================================================
    // Semantic feedback (all [600] shades for muted density)
    // ========================================================================
    'color-success': success[600],
    'color-warning': warning[600],
    'color-danger': danger[600],
    'color-info': info[600],

    // ========================================================================
    // Typography (shared with web — same brand fonts, no admin override)
    // ========================================================================
    'font-body': fontFamily.sans,
    'font-heading': fontFamily.heading,

    // ========================================================================
    // Radius (shared with web — same 0.75rem base)
    // ========================================================================
    radius: radiusBase,

    // ========================================================================
    // Web brand tokens — exposed in the admin scope so cross-app visual
    // mappings (e.g. the accommodation-type badge, whose icon + color SSOT
    // lives in `@repo/icons`) render with the SAME colors in admin as in web.
    // Values mirror `web-light.ts` exactly. Names match web's CSS var names
    // (`--brand-accent`, `--hospeda-forest`, …) so the shared scheme strings
    // (`var(--brand-accent)`, `oklch(from var(--hospeda-forest) …)`) resolve.
    // ========================================================================
    'brand-primary': river[500],
    'brand-accent': accent[500],
    'brand-secondary': brandSecondary,
    'hospeda-river': river[500],
    'hospeda-sky': sky[500],
    'hospeda-forest': forest[500],
    'hospeda-sand': sand[500],
    muted: WEB_MUTED,
    info: info[500],
    warning: warning[500],
    'warning-foreground': WEB_WARNING_FOREGROUND,
    'core-foreground': WEB_CORE_FOREGROUND,

    // ========================================================================
    // Accommodation-type per-type tokens — shared verbatim with web-light
    // (same source constant). Each references its base palette's shade-500
    // primitive (`--palette-<name>-500`), which is emitted once in `:root`
    // and theme-independent, so the accommodation-type badge renders with the
    // SAME hue in admin as in web across light and dark.
    // ========================================================================
    ...accommodationTypeTokens,
    // Per-event-category tokens (same source constant as web), each referencing
    // its base palette's shade-500 primitive so the category badge renders with
    // the SAME hue in admin as in web across light and dark.
    ...eventCategoryTokens,
    // Per-post-category tokens (same source constant as web), each referencing
    // an existing base palette per the prior badge colors.
    ...postCategoryTokens
};
