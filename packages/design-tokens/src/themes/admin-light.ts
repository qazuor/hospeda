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
 *   - Primary uses `river[600]` (not `river[500]`): denser, more muted.
 *     Admin's working surfaces benefit from less saturated chrome.
 *   - Accent uses `accent[600]` (vs web's [500]): same muted reasoning.
 *   - Background uses `neutral[100]` (vs web's `oklch(0.985 0.002 210)`):
 *     slightly grayer "workspace" tone.
 *   - Semantic feedback colors (success/warning/danger/info) all use
 *     `[600]` shades for the same muted-density principle.
 *
 * The CSS generator (T-153-16) emits these declarations inside
 * `[data-app="admin"]` so they apply only to pages that opt in by
 * setting `data-app="admin"` on `<html>` (admin's root layout — done
 * in Phase 3 T-153-25).
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
import { radiusBase } from '../tokens/radius.js';
import { fontFamily } from '../tokens/typography.js';
import type { Theme } from './types.js';

/** White surface for elevated UI (cards, modals) — not part of neutral. */
const PURE_WHITE: OKLCH = { l: 1, c: 0, h: 0 };

export const adminLight: Theme = {
    // ========================================================================
    // Primary (river — same hue family as web for brand coherence, denser
    // shade for productivity-focused chrome)
    // ========================================================================
    'color-primary': river[600],
    'color-primary-hover': river[500],
    'color-primary-pressed': river[700],

    // ========================================================================
    // Accent (orange — slightly muted vs web)
    // ========================================================================
    'color-accent': accent[600],

    // ========================================================================
    // Background / surface (grayer "workspace" tone)
    // ========================================================================
    'color-bg-app': neutral[100],
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
    radius: radiusBase
};
