/**
 * @file themes/web-dark.ts
 * @description Web dark theme overrides for SPEC-153.
 *
 * The 56 CSS custom properties web's `[data-theme="dark"]` block
 * overrides in `apps/web/src/styles/global.css`. Every entry is
 * byte-for-byte equivalent to the seed manifest so Phase 2 dark-mode
 * snapshots pixel-diff against baseline at 0.
 *
 * Tokens NOT listed here (radius scale, spacing, fonts, semantic
 * typography composites, motion, z-index, layout, overlays, frost-blur,
 * containers) are NOT overridden in dark mode and inherit from
 * `web-light.ts` via cascade.
 *
 * The CSS generator (T-153-16) emits these declarations inside
 * `[data-theme="dark"]:not([data-app="admin"])` so they apply to web
 * only — admin gets its own dark mapping in `admin-dark.ts`.
 */

import type { OKLCH } from '../tokens/colors.js';
import type { Theme } from './types.js';

/** Hand-tuned OKLCH not part of any palette (same helper as web-light.ts). */
const oklchValue = (l: number, c: number, h: number): OKLCH => ({ l, c, h });

export const webDark: Theme = {
    // ========================================================================
    // Core palette dark overrides — global.css lines 231–257
    // ========================================================================
    'core-background': oklchValue(0.205, 0.035, 258),
    'core-foreground': oklchValue(0.92, 0.01, 210),
    'core-card': oklchValue(0.275, 0.042, 258),
    'card-foreground': oklchValue(0.93, 0.012, 250),
    popover: oklchValue(0.3, 0.042, 258),
    'popover-foreground': oklchValue(0.93, 0.012, 250),

    'brand-primary': oklchValue(0.68, 0.17, 259),
    'brand-primary-text': oklchValue(0.68, 0.17, 259),
    // SPEC-308: the vibrant blue (0.68) clears AA on the page canvas, but as
    // text on the faint blue-tinted chips (8-15% brand over navy) it lands at
    // ~4.0-4.49 — just under 4.5. Lift the link/AA text token so brand text on
    // those tinted chips clears AA. Used by dest-card chips, event-card location,
    // and the category chips (repointed to this token in lib/colors).
    // BETA-126: 0.74 still landed at 4.48 on the sky-tinted post category chip
    // ("Deportes" over #2e3f57) — 0.02 short. Lifted to 0.77 (~4.93 on that same
    // chip) so every primary-link chip clears AA with a comfortable margin.
    'brand-primary-link': oklchValue(0.77, 0.16, 259),
    'primary-foreground': oklchValue(0.1, 0.02, 259),
    'brand-secondary': oklchValue(0.25, 0.05, 255),
    'brand-secondary-foreground': oklchValue(0.8, 0.08, 255),
    'brand-tertiary': oklchValue(0.28, 0.05, 155),
    // SPEC-308: AA-safe green text token for category chips on dark. The base
    // forest (0.5) reads at only ~2.4:1 as text on the navy-tinted green chip;
    // lift to 0.72 so it clears AA. Only the chip *text* uses this — the solid
    // forest fill (date-block bg) stays the saturated base green.
    'hospeda-forest-link': oklchValue(0.72, 0.15, 155),

    muted: oklchValue(0.255, 0.035, 258),
    'core-muted-foreground': oklchValue(0.68, 0.03, 261),

    'brand-accent': oklchValue(0.72, 0.19, 55),
    // SPEC-308: vibrant orange already clears AA as text on dark surfaces, so
    // both orange-text tokens keep the bright value here.
    'brand-accent-strong': oklchValue(0.72, 0.19, 55),
    'brand-accent-text': oklchValue(0.72, 0.19, 55),
    'rating-star': oklchValue(0.85, 0.19, 95),
    'accent-foreground': oklchValue(0.1, 0.01, 55),

    destructive: oklchValue(0.6, 0.22, 27),
    'destructive-foreground': oklchValue(0.98, 0, 0),

    overlay: 'oklch(0.05 0.01 220 / 0.7)',
    border: oklchValue(0.4, 0.03, 258),
    input: oklchValue(0.32, 0.03, 258),
    ring: oklchValue(0.68, 0.17, 259),

    // ========================================================================
    // Overlay surface — toast/popover contrast fix (dark).
    //
    // Dark cannot reuse the light recipe: a foreground-tinted shadow on a
    // near-black page reads as almost nothing, and the surface itself has to
    // be visibly LIGHTER than the page to register as "raised" at all (light
    // mode gets that lift for free from white-on-off-white; dark needs an
    // explicit, deliberately-lighter fill). `--surface-overlay` sits above
    // both `--core-background` (0.205) and `--core-card` (0.275) so a toast
    // or popover reads as its own elevated layer, not just another card.
    // `--shadow-overlay` drops the relative-color trick for literal black at
    // real weight, plus an `inset` top highlight that fakes a light source
    // catching the surface's top edge — the cue eyes actually use to read
    // "this is floating above, not embedded in" on a dark canvas.
    // ========================================================================
    'surface-overlay': oklchValue(0.37, 0.045, 258),
    'overlay-ring': 'oklch(0.94 0.02 258 / 0.26)',
    'shadow-overlay':
        '0 28px 64px -12px oklch(0 0 0 / 0.72), 0 8px 22px -4px oklch(0 0 0 / 0.6), 0 0 50px 6px oklch(0 0 0 / 0.38), inset 0 1px 0 oklch(1 0 0 / 0.1)',
    // A touch stronger than light's 0.12 — dark surfaces need more contrast
    // for the same "click outside to close" affordance to register.
    'popover-scrim': 'oklch(0 0 0 / 0.22)',

    'chart-1': oklchValue(0.68, 0.17, 259),
    'chart-2': oklchValue(0.68, 0.15, 155),
    'chart-3': oklchValue(0.72, 0.19, 55),
    'chart-4': oklchValue(0.78, 0.11, 190),
    'chart-5': oklchValue(0.62, 0.1, 240),

    // ========================================================================
    // Hover variants — dark mode flips the direction (LIGHTER on hover)
    // global.css lines 260–262
    // ========================================================================
    'primary-hover': 'oklch(from var(--brand-primary) calc(l + 0.07) c h)',
    'accent-hover': 'oklch(from var(--brand-accent) calc(l + 0.07) c h)',
    'brand-primary-dark': 'oklch(from var(--brand-primary) calc(l - 0.08) c h)',

    // ========================================================================
    // Feedback tokens (dark) — global.css lines 265–270
    // ========================================================================
    success: oklchValue(0.65, 0.16, 150),
    'success-foreground': oklchValue(0.1, 0.02, 150),
    warning: oklchValue(0.78, 0.18, 85),
    'warning-foreground': oklchValue(0.1, 0.02, 85),
    info: oklchValue(0.68, 0.17, 259),
    'info-foreground': oklchValue(0.1, 0.02, 259),

    // ========================================================================
    // Surface tokens (dark) — global.css lines 273–277
    // ========================================================================
    'surface-warm': oklchValue(0.255, 0.035, 258),
    'surface-dark': oklchValue(0.185, 0.03, 258),
    'surface-elevated': oklchValue(0.285, 0.04, 258),
    // SPEC-308: the dark navy ramp flipped surface-warm to a dark fill, but
    // --surface-warm-foreground was only defined in web-light.ts (dark ink for
    // the light cream surface). Without a dark override it inherited that dark
    // ink → dark-on-dark inversion (e.g. ContributionBanner title/desc contrast
    // 1.4). Provide a light foreground so text on this surface clears AA in dark.
    'surface-warm-foreground': oklchValue(0.92, 0.01, 210),
    // HOS-84: dedicated header-band token (Opt-B "band puro"). Placeholder values
    // mirror --surface-warm until the final hue is confirmed against the visual
    // mockup (T-017/T-019). Explicit dark base + foreground per the SPEC-308 lesson —
    // dark does not re-derive a foreground from its light sibling.
    'surface-header': oklchValue(0.255, 0.035, 258),
    'surface-header-foreground': oklchValue(0.92, 0.01, 210),

    // Hero bottom-wave fill. In dark it must follow the page canvas so the
    // wave blends into the section below (the SVG hardcodes --core-card, which
    // is lighter and showed a seam). Only defined for dark; in light the wave's
    // inline `fill` falls back to --core-card.
    'hero-wave-fill': 'var(--core-background)',

    // ========================================================================
    // Footer surface tokens (dark) — global.css lines 280–288
    // ========================================================================
    'footer-bg': oklchValue(0.12, 0.02, 220),
    'footer-fg': oklchValue(0.85, 0.01, 210),
    'footer-fg-muted': oklchValue(0.6, 0.02, 240),
    'footer-newsletter-bg': oklchValue(0.18, 0.025, 220),
    'footer-newsletter-fg': oklchValue(0.8, 0.01, 210),
    'footer-newsletter-border': oklchValue(0.3, 0.02, 220),
    'footer-link': oklchValue(0.65, 0.01, 210),
    'footer-link-hover': oklchValue(0.9, 0.01, 210),
    'footer-border': 'oklch(from var(--brand-accent) l c h / 0.2)',

    // ========================================================================
    // Social proof avatar gradient stops (dark) — global.css lines 291–298
    // ========================================================================
    'avatar-1-from': oklchValue(0.3, 0.1, 255),
    'avatar-1-to': oklchValue(0.42, 0.14, 255),
    'avatar-2-from': oklchValue(0.68, 0.16, 75),
    'avatar-2-to': oklchValue(0.8, 0.18, 80),
    'avatar-3-from': oklchValue(0.52, 0.11, 195),
    'avatar-3-to': oklchValue(0.68, 0.14, 195),
    'avatar-4-from': oklchValue(0.45, 0.13, 155),
    'avatar-4-to': oklchValue(0.65, 0.17, 155)
};
