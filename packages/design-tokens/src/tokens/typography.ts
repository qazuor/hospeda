/**
 * @file typography.ts
 * @description Typography tokens for SPEC-153.
 *
 * Two coexisting layers:
 *
 *   1. **Base scales** per doc 05 §5.2 — fontFamily, a numeric fontSize
 *      ladder (xs → 5xl), fontWeight, and lineHeight. These are the
 *      foundation that admin's Tailwind v4 theme (T-153-26) maps utility
 *      classes to (`text-xs`, `font-bold`, etc.).
 *
 *   2. **Semantic composites** — text-hero, text-display, text-h2..h4,
 *      text-body / -sm / -xs / -lg, text-meta, text-caption, text-tagline,
 *      text-nav, text-button, text-lg, text-xl. Sourced byte-for-byte
 *      from apps/web/src/styles/global.css :root. These exist for web's
 *      marketing layouts (clamp expressions tuned for fluid heroes /
 *      display headings) and stay in the package so the Phase 2
 *      pixel-diff gate at 0 holds.
 *
 * Caveat (font-decorative) is web-only by design (doc 05 §3 Eje 4) — the
 * admin theme will never reference it. We still export it from this
 * module so web's @import of tokens.css resolves all its current vars.
 *
 * All values are strings (CSS expressions) including the numeric scale,
 * since they're emitted directly into CSS custom properties. fontWeight
 * is the exception — it's emitted as a number per CSS spec.
 */

// ============================================================================
// Font families
// ============================================================================

/**
 * Font family CSS values per doc 05 §5.2 + web's current global.css.
 *
 *  - `sans`       — body, UI (Roboto with system fallback).
 *  - `heading`    — h1-h3 + display surfaces (Geologica).
 *  - `decorative` — taglines, "handwritten" marketing accent (Caveat).
 *    Intentionally NOT consumed by admin — the admin theme picks
 *    `heading` for any decorative typographic role instead.
 *  - `mono`       — code blocks (web only).
 */
export const fontFamily = {
    sans: '"Roboto", sans-serif',
    heading: '"Geologica", sans-serif',
    decorative: '"Caveat", cursive',
    mono: 'ui-monospace, "Menlo", "Monaco", "Cascadia Code", monospace'
} as const satisfies Record<string, string>;

export type FontFamilyName = keyof typeof fontFamily;

// ============================================================================
// Font size — base scale (doc 05 §5.2)
//
// This is the numeric ladder admin's Tailwind utilities map to (`text-xs`
// through `text-5xl`). Web's hand-tuned semantic composites below are
// orthogonal — they don't reuse these keys to stay readable in source.
// ============================================================================

export const fontSize = {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem' // 48px
} as const satisfies Record<string, string>;

export type FontSizeKey = keyof typeof fontSize;

// ============================================================================
// Font weight (doc 05 §5.2)
// ============================================================================

export const fontWeight = {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
} as const satisfies Record<string, number>;

export type FontWeightName = keyof typeof fontWeight;

// ============================================================================
// Line height (doc 05 §5.2)
// ============================================================================

export const lineHeight = {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75
} as const satisfies Record<string, number>;

export type LineHeightName = keyof typeof lineHeight;

// ============================================================================
// Semantic typography — anchored byte-for-byte to web's global.css
//
// These are NOT a ladder; each entry is the value of a specific web token
// that compose font-size, in some cases via `clamp()` for fluid scaling
// across viewports. Keys are camelCase here; the CSS generator maps them
// back to kebab-case tokens (`--text-body-sm`, `--text-hero`, …) in the
// emitted tokens.css.
// ============================================================================

export const semanticTypography = {
    /** Marketing hero — clamp from 48px to 92px. Web token `--text-hero`. */
    hero: 'clamp(3rem, 2rem + 5vw, 5.75rem)',
    /** Display heading — clamp from 32px to 48px. Web token `--text-display`. */
    display: 'clamp(2rem, 1.5rem + 3vw, 3rem)',
    /** H2 section title — clamp from 28px to 44px. Web token `--text-h2`. */
    h2: 'clamp(1.75rem, 1.5rem + 1.75vw, 2.75rem)',
    /** H3 sub-section — clamp from 20px to 26px. Web token `--text-h3`. */
    h3: 'clamp(1.25rem, 1rem + 0.75vw, 1.625rem)',
    /** H4 small heading — clamp from 15px to 18px. Web token `--text-h4`. */
    h4: 'clamp(0.9375rem, 0.875rem + 0.25vw, 1.125rem)',

    /** Default body text 16px. Web token `--text-body`. */
    body: '1rem',
    /** Smaller body text 14px. Web token `--text-body-sm`. */
    bodySm: '0.875rem',
    /** Smallest body text 13px. Web token `--text-body-xs`. */
    bodyXs: '0.8125rem',
    /** Emphasis body text 18px. Web token `--text-body-lg`. */
    bodyLg: '1.125rem',

    /** Meta annotations (timestamps, byline) 13px. Web token `--text-meta`. */
    meta: '0.8125rem',
    /** Caption (image captions, small print) 12px. Web token `--text-caption`. */
    caption: '0.75rem',
    /** Tagline (decorative subheadings) — clamp from 20px to 28px. Web token `--text-tagline`. */
    tagline: 'clamp(1.25rem, 1rem + 1vw, 1.75rem)',

    /** Navigation link text 14px. Web token `--text-nav`. */
    nav: '0.875rem',
    /** Button label text 16px. Web token `--text-button`. */
    button: '1rem',

    /** Inline large emphasis 20px. Web token `--text-lg`. */
    lg: '1.25rem',
    /** Inline extra-large emphasis 24px. Web token `--text-xl`. */
    xl: '1.5rem',

    /** Small UI text 14px (same size as bodySm). Web token `--text-sm`. */
    sm: '0.875rem',
    /** Smallest heading 18px. Web token `--text-h6`. */
    h6: '1.125rem',
    /** Medium body text 15px. Web token `--text-body-md`. */
    bodyMd: '0.9375rem'
} as const satisfies Record<string, string>;

export type SemanticTypographyName = keyof typeof semanticTypography;

// ============================================================================
// Master typography aggregate
// ============================================================================

export const typography = {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    semantic: semanticTypography
} as const;
