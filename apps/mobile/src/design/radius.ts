/**
 * @file radius.ts
 * @description Mobile border-radius tokens for the Hospeda design system (T-006).
 *
 * Sourced from `packages/design-tokens/src/tokens/radius.ts`. Web values use
 * `calc(var(--radius) ...)` CSS expressions — not valid in React Native.
 * This module resolves all relative expressions against the canonical base
 * radius (`0.75rem` = 12px) to produce flat numeric pixel values suitable
 * for React Native `StyleSheet.create`.
 *
 * ## Conversion
 * - `radiusBase = '0.75rem'` → 12px.
 * - `calc(var(--radius) - 4px)` → 12 - 4 = 8.
 * - `calc(var(--radius) - 2px)` → 12 - 2 = 10.
 * - `calc(var(--radius) + 4px)` → 12 + 4 = 16.
 * - `24px` → 24 (direct conversion, already px).
 * - `9999px` → capped at 9999 (RN accepts large values for pill shapes, but
 *   `borderRadius: 9999` is the conventional RN idiom for a full pill).
 * - `8px` → 8.
 * - Organic / deprecated asymmetric radii (`'0px 100px'`) are excluded —
 *   React Native's `borderRadius` does not support the shorthand pair syntax.
 *   Per `packages/design-tokens/src/tokens/radius.ts`, organic radii are
 *   deprecated and must not be used in new code.
 *
 * DO NOT import `@repo/tailwind-config` here (ADR-033).
 */

// ============================================================================
// Base radius
//
// Canonical source: packages/design-tokens/src/tokens/radius.ts `radiusBase`.
// Web: '0.75rem'; mobile: 12px.
// ============================================================================

/**
 * Base border-radius in pixels (12px = `0.75rem`).
 *
 * Web token `--radius`. All scale values are derived relative to this base.
 *
 * @example
 * ```ts
 * borderRadius: radius.base  // 12
 * ```
 */
export const base = 12;

// ============================================================================
// Radius scale — resolved against base=12px
//
// Canonical source: packages/design-tokens/src/tokens/radius.ts `radiusScale`.
// ============================================================================

/**
 * Radius scale resolved to absolute pixel values.
 *
 * | Key | CSS expression             | Resolved px |
 * |-----|----------------------------|-------------|
 * | sm  | `calc(var(--radius) - 4px)` | 8           |
 * | md  | `calc(var(--radius) - 2px)` | 10          |
 * | lg  | `var(--radius)`             | 12          |
 * | xl  | `calc(var(--radius) + 4px)` | 16          |
 *
 * @example
 * ```ts
 * borderRadius: radius.scale.sm   // 8  — input fields
 * borderRadius: radius.scale.md   // 10 — small buttons
 * borderRadius: radius.scale.lg   // 12 — default containers
 * borderRadius: radius.scale.xl   // 16 — elevated cards
 * ```
 */
export const scale = {
    /** ~8px — small input fields, compact badges. */
    sm: 8,
    /** ~10px — medium controls. */
    md: 10,
    /** 12px — equal to base. Default container rounding. */
    lg: 12,
    /** ~16px — elevated cards, modals. */
    xl: 16
} as const;

export type RadiusScaleKey = keyof typeof scale;

// ============================================================================
// Semantic radius — absolute component-specific values
//
// Canonical source: packages/design-tokens/src/tokens/radius.ts `radiusSemantic`.
// ============================================================================

/**
 * Component-specific absolute border-radius values.
 *
 * | Key    | Web value | px   | Component context                      |
 * |--------|-----------|------|----------------------------------------|
 * | card   | `24px`    | 24   | Outer container of accommodation cards |
 * | pill   | `9999px`  | 9999 | Badges, tags, avatars (fully rounded)  |
 * | button | `8px`     | 8    | Standard action buttons                |
 *
 * @example
 * ```ts
 * borderRadius: radius.semantic.card    // 24 — accommodation card
 * borderRadius: radius.semantic.pill    // 9999 — tag / badge
 * borderRadius: radius.semantic.button  // 8 — primary button
 * ```
 */
export const semantic = {
    /** Outer container of cards. Web token `--radius-card`. */
    card: 24,
    /**
     * Fully rounded — badges, tags, avatars.
     * Web token `--radius-pill`. RN convention: `borderRadius: 9999`.
     */
    pill: 9999,
    /** Standard button radius. Web token `--radius-button`. */
    button: 8
} as const;

export type RadiusSemanticName = keyof typeof semantic;

// ============================================================================
// Master radius aggregate
// ============================================================================

/**
 * Complete mobile border-radius token set for the Hospeda design system.
 *
 * All values are numeric pixels suitable for React Native `StyleSheet.create`.
 * Derived from `packages/design-tokens/src/tokens/radius.ts` with CSS
 * expressions resolved against the 12px (`0.75rem`) base radius.
 *
 * ## Usage with StyleSheet.create
 * ```ts
 * import { StyleSheet } from 'react-native';
 * import { radius } from '../design';
 *
 * const styles = StyleSheet.create({
 *   card:   { borderRadius: radius.semantic.card },   // 24
 *   button: { borderRadius: radius.semantic.button }, // 8
 *   badge:  { borderRadius: radius.semantic.pill },   // 9999
 *   input:  { borderRadius: radius.scale.sm },        // 8
 * });
 * ```
 */
export const radius = {
    base,
    scale,
    semantic
} as const;
