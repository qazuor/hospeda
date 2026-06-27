/**
 * @file spacing.ts
 * @description Mobile spacing tokens for the Hospeda design system (T-006).
 *
 * Sourced from `packages/design-tokens/src/tokens/spacing.ts`. Web values
 * are rem strings; React Native requires numeric pixel values.
 *
 * ## Conversion
 * - `1rem` base = 16px.
 * - `0.25rem` → 4, `0.5rem` → 8, `0.75rem` → 12, `1rem` → 16, etc.
 * - Semantic composites that use `clamp()` or `%`-based values are omitted
 *   (they have no meaning in React Native's layout engine). Only the numeric
 *   scale is ported; component-level spacing decisions happen at the screen /
 *   component level using these raw tokens.
 *
 * DO NOT import `@repo/tailwind-config` here (ADR-034).
 */

// ============================================================================
// Numeric scale — rem→px conversion
//
// Canonical source: packages/design-tokens/src/tokens/spacing.ts `spacing`.
// Each key is the Tailwind-style multiplier; value is the pixel equivalent.
// ============================================================================

/**
 * Spacing scale in pixels for React Native.
 *
 * Keys are the canonical Tailwind-style multipliers from the Hospeda design
 * system. Values are exact rem×16 conversions.
 *
 * | Key | rem     | px  | Common use                  |
 * |-----|---------|-----|-----------------------------|
 * | 0   | 0       | 0   | Reset                       |
 * | 1   | 0.25rem | 4   | Tight gap / icon padding    |
 * | 2   | 0.5rem  | 8   | Small gap between elements  |
 * | 3   | 0.75rem | 12  | Compact card padding        |
 * | 4   | 1rem    | 16  | Default padding / gap       |
 * | 5   | 1.25rem | 20  | Section inner padding       |
 * | 6   | 1.5rem  | 24  | Card padding                |
 * | 7   | 1.75rem | 28  | Medium spacing              |
 * | 8   | 2rem    | 32  | Section padding             |
 * | 9   | 2.25rem | 36  | Large gap                   |
 * | 10  | 2.5rem  | 40  | Hero inner padding          |
 * | 12  | 3rem    | 48  | Section vertical padding    |
 * | 16  | 4rem    | 64  | Large section spacing       |
 * | 20  | 5rem    | 80  | Extra-large spacing         |
 * | 24  | 6rem    | 96  | Maximum spacing             |
 *
 * @example
 * ```ts
 * padding: spacing[4]             // 16
 * marginBottom: spacing[2]        // 8
 * gap: spacing[3]                 // 12 (RN 0.71+ gap support)
 * ```
 */
export const spacing = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
    24: 96
} as const;

export type SpacingKey = keyof typeof spacing;
