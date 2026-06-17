/**
 * @file typography.ts
 * @description Mobile typography tokens for the Hospeda design system (T-006).
 *
 * Sourced from `packages/design-tokens/src/tokens/typography.ts`. Web values
 * use rem strings and CSS `clamp()` expressions — neither is valid in React
 * Native `StyleSheet`. This module translates the canonical scale to numeric
 * pixel values (React Native's `fontSize` and `lineHeight` are numeric; there
 * is no `rem` concept in RN's layout engine).
 *
 * ## Conversion
 * - `1rem` base = 16px (the universal CSS assumption).
 * - `0.75rem` → 12, `0.875rem` → 14, `1rem` → 16, `1.125rem` → 18, etc.
 * - Font families: RN only supports fonts that are bundled; the web-canonical
 *   families (Roboto, Geologica, Caveat) are listed for completeness. In
 *   practice, RN falls back to the system font if the font is not loaded via
 *   `expo-font`. Use the `fontFamily` constants as the token names to swap in
 *   real font loading (T-NNN, future spec).
 * - `clamp()` values (hero, display, h2, h3, h4, tagline) are not portable to
 *   RN. Only the fixed-px semantic sizes (body, bodySm, caption, etc.) that
 *   correspond 1:1 with rem values are exported; fluid heading sizes are
 *   replaced with sensible fixed mobile equivalents at the lower bound of
 *   the web clamp range (mobile viewports are always in the narrow range).
 * - `lineHeight` in RN is absolute pixels (not a unitless ratio). Line heights
 *   are computed as `Math.round(fontSize * ratio)` for each size.
 *
 * DO NOT import `@repo/tailwind-config` here (ADR-034).
 */

// ============================================================================
// Font families
//
// Canonical source: packages/design-tokens/src/tokens/typography.ts `fontFamily`.
// ============================================================================

/**
 * Font family identifiers for Hospeda's type system.
 *
 * `sans` (Roboto) and `heading` (Geologica) are the primary web families.
 * In React Native, font files must be loaded via `expo-font` before these
 * names will resolve. System fallbacks apply when fonts are not loaded:
 * `sans` → system sans-serif, `heading` → system sans-serif.
 *
 * `decorative` (Caveat) is web-only per doc 05 §5.2 and should not be used
 * in mobile UI — it is included here only for completeness.
 *
 * @example
 * ```ts
 * fontFamily: typography.fontFamily.sans      // 'Roboto'
 * fontFamily: typography.fontFamily.heading   // 'Geologica'
 * ```
 */
export const fontFamily = {
    /** Primary body / UI font. Web: `"Roboto", sans-serif`. */
    sans: 'Roboto',
    /** Display / heading font. Web: `"Geologica", sans-serif`. */
    heading: 'Geologica',
    /** Decorative accent font (web-only; do not use in mobile UI). */
    decorative: 'Caveat'
} as const;

export type FontFamilyName = keyof typeof fontFamily;

// ============================================================================
// Font sizes — numeric px values
//
// Canonical source: packages/design-tokens/src/tokens/typography.ts `fontSize`.
// Conversion: rem × 16.
// ============================================================================

/**
 * Font size scale in pixels (numeric, as required by React Native).
 *
 * | Key   | rem        | px | Tailwind equivalent |
 * |-------|------------|----|---------------------|
 * | xs    | 0.75rem    | 12 | `text-xs`           |
 * | sm    | 0.875rem   | 14 | `text-sm`           |
 * | base  | 1rem       | 16 | `text-base`         |
 * | lg    | 1.125rem   | 18 | `text-lg`           |
 * | xl    | 1.25rem    | 20 | `text-xl`           |
 * | 2xl   | 1.5rem     | 24 | `text-2xl`          |
 * | 3xl   | 1.875rem   | 30 | `text-3xl`          |
 * | 4xl   | 2.25rem    | 36 | `text-4xl`          |
 * | 5xl   | 3rem       | 48 | `text-5xl`          |
 *
 * @example
 * ```ts
 * fontSize: typography.fontSize.base    // 16
 * fontSize: typography.fontSize['2xl']  // 24
 * ```
 */
export const fontSize = {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48
} as const;

export type FontSizeKey = keyof typeof fontSize;

// ============================================================================
// Font weights
//
// Canonical source: packages/design-tokens/src/tokens/typography.ts `fontWeight`.
// React Native uses the same numeric values — no conversion needed.
// ============================================================================

/**
 * Font weight numeric values.
 *
 * React Native accepts numeric weight values for `fontWeight`.
 * Web and mobile share the same numeric constants.
 *
 * @example
 * ```ts
 * fontWeight: typography.fontWeight.bold      // 700
 * fontWeight: typography.fontWeight.semibold  // 600
 * ```
 */
export const fontWeight = {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
} as const;

export type FontWeightName = keyof typeof fontWeight;

// ============================================================================
// Line heights — absolute px values
//
// Canonical source: packages/design-tokens/src/tokens/typography.ts `lineHeight`
// (unitless ratios: tight=1.2, normal=1.5, relaxed=1.75).
//
// React Native requires ABSOLUTE pixel values for lineHeight. The pattern:
//   lineHeight = fontSize × ratio
// is applied at usage time via `lineHeightFor(fontSize, ratio)` below.
// We also export the raw ratios for reference.
// ============================================================================

/**
 * Line-height ratios (unitless multipliers, same as web tokens).
 *
 * In React Native, multiply by the relevant `fontSize` to get an absolute
 * line-height pixel value: `lineHeight = fontSize * lineHeightRatio.normal`.
 *
 * Alternatively, use the `lineHeightFor` helper which does this for you.
 *
 * @example
 * ```ts
 * // Manual
 * lineHeight: typography.fontSize.base * typography.lineHeightRatio.normal // 24
 *
 * // Via helper
 * lineHeight: lineHeightFor(typography.fontSize.base, 'normal')  // 24
 * ```
 */
export const lineHeightRatio = {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75
} as const;

export type LineHeightRatioName = keyof typeof lineHeightRatio;

/**
 * Compute an absolute line-height pixel value for React Native.
 *
 * React Native's `lineHeight` property must be a number (absolute pixels),
 * not a unitless ratio as in CSS. This helper applies the Hospeda ratio to
 * a given font size and rounds to the nearest integer.
 *
 * @param size - Font size in pixels (e.g. `typography.fontSize.base`).
 * @param ratio - Line-height ratio name from `lineHeightRatio`.
 * @returns Absolute line-height in pixels, suitable for `StyleSheet.create`.
 *
 * @example
 * ```ts
 * lineHeight: lineHeightFor(16, 'normal')   // 24
 * lineHeight: lineHeightFor(24, 'tight')    // 29
 * lineHeight: lineHeightFor(14, 'relaxed')  // 25
 * ```
 */
export function lineHeightFor(size: number, ratio: LineHeightRatioName): number {
    return Math.round(size * lineHeightRatio[ratio]);
}

// ============================================================================
// Semantic sizes — mobile-adapted fixed values
//
// Web's semantic typography uses `clamp()` for fluid viewport scaling.
// React Native has no viewport units; we use the lower bound of each
// web clamp range as the mobile-appropriate fixed size (mobile screens
// always fall in the narrow/compact range of the clamp).
//
// Source: packages/design-tokens/src/tokens/typography.ts `semanticTypography`.
// Only fixed-px values are 1:1 ports; clamp ranges are annotated.
// ============================================================================

/**
 * Semantic typography sizes in pixels for mobile.
 *
 * Fixed-value entries (body, caption, etc.) are direct rem→px conversions.
 * Fluid-range entries (hero, display, headings) use the lower bound of the
 * web `clamp()` range, which is the value rendered on narrow mobile viewports.
 *
 * | Key        | Web value                         | Mobile px |
 * |------------|-----------------------------------|-----------|
 * | hero       | `clamp(3rem, …, 5.75rem)` [48–92] | 40        |
 * | display    | `clamp(2rem, …, 3rem)` [32–48]    | 32        |
 * | h2         | `clamp(1.75rem, …, 2.75rem)` [28–44] | 28     |
 * | h3         | `clamp(1.25rem, …, 1.625rem)` [20–26] | 20    |
 * | h4         | `clamp(0.9375rem, …, 1.125rem)` [15–18] | 15  |
 * | body       | `1rem` (fixed)                    | 16        |
 * | bodySm     | `0.875rem` (fixed)                | 14        |
 * | bodyXs     | `0.8125rem` (fixed)               | 13        |
 * | bodyLg     | `1.125rem` (fixed)                | 18        |
 * | meta       | `0.8125rem` (fixed)               | 13        |
 * | caption    | `0.75rem` (fixed)                 | 12        |
 * | button     | `1rem` (fixed)                    | 16        |
 * | nav        | `0.875rem` (fixed)                | 14        |
 *
 * @example
 * ```ts
 * fontSize: typography.semantic.body       // 16
 * fontSize: typography.semantic.caption    // 12
 * fontSize: typography.semantic.h2        // 28
 * ```
 */
export const semanticSize = {
    // Fluid headings — lower bound of web clamp range
    hero: 40,
    display: 32,
    h2: 28,
    h3: 20,
    h4: 15,

    // Fixed-px body sizes (direct rem×16 conversion)
    body: 16,
    bodySm: 14,
    bodyXs: 13,
    bodyLg: 18,
    meta: 13,
    caption: 12,

    // UI text
    button: 16,
    nav: 14
} as const;

export type SemanticSizeKey = keyof typeof semanticSize;

// ============================================================================
// Master typography aggregate
// ============================================================================

/**
 * Complete mobile typography token set for the Hospeda design system.
 *
 * ## Usage with StyleSheet.create
 * ```ts
 * import { StyleSheet } from 'react-native';
 * import { typography, lineHeightFor } from '../design';
 *
 * const styles = StyleSheet.create({
 *   heading: {
 *     fontFamily: typography.fontFamily.heading,
 *     fontSize: typography.semantic.h2,
 *     fontWeight: String(typography.fontWeight.bold) as '700',
 *     lineHeight: lineHeightFor(typography.semantic.h2, 'tight'),
 *   },
 *   body: {
 *     fontFamily: typography.fontFamily.sans,
 *     fontSize: typography.semantic.body,
 *     fontWeight: String(typography.fontWeight.normal) as '400',
 *     lineHeight: lineHeightFor(typography.semantic.body, 'normal'),
 *   },
 * });
 * ```
 */
export const typography = {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeightRatio,
    semantic: semanticSize
} as const;
