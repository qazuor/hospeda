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
    'core-background': oklchValue(0.14, 0.02, 220),
    'core-foreground': oklchValue(0.92, 0.01, 210),
    'core-card': oklchValue(0.19, 0.02, 220),
    'card-foreground': oklchValue(0.92, 0.01, 210),
    popover: oklchValue(0.19, 0.02, 220),
    'popover-foreground': oklchValue(0.92, 0.01, 210),

    'brand-primary': oklchValue(0.68, 0.17, 259),
    'brand-primary-text': oklchValue(0.68, 0.17, 259),
    'primary-foreground': oklchValue(0.1, 0.02, 259),
    'brand-secondary': oklchValue(0.25, 0.05, 255),
    'brand-secondary-foreground': oklchValue(0.8, 0.08, 255),
    'brand-tertiary': oklchValue(0.28, 0.05, 155),

    muted: oklchValue(0.22, 0.02, 220),
    'core-muted-foreground': oklchValue(0.6, 0.03, 261),

    'brand-accent': oklchValue(0.72, 0.19, 55),
    'rating-star': oklchValue(0.85, 0.19, 95),
    'accent-foreground': oklchValue(0.1, 0.01, 55),

    destructive: oklchValue(0.6, 0.22, 27),
    'destructive-foreground': oklchValue(0.98, 0, 0),

    overlay: 'oklch(0.05 0.01 220 / 0.7)',
    border: oklchValue(0.28, 0.02, 220),
    input: oklchValue(0.28, 0.02, 220),
    ring: oklchValue(0.68, 0.17, 259),

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
    'surface-warm': oklchValue(0.2, 0.03, 50),
    'surface-dark': oklchValue(0.1, 0.02, 160),
    'surface-elevated': oklchValue(0.24, 0.025, 220),

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
