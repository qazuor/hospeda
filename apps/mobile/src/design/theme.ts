/**
 * @file theme.ts
 * @description Aggregated theme object + StyleSheet.create convention (T-007).
 *
 * ## The StyleSheet.create convention for Hospeda mobile
 *
 * React Native styles are created with `StyleSheet.create`, NOT with
 * NativeWind or any CSS-in-JS library (ADR-033). The convention is:
 *
 * 1. Import tokens from the design barrel (`../design`).
 * 2. Define styles at module scope using `StyleSheet.create({...})`.
 * 3. Reference token values directly — no string concatenation, no `px`.
 *
 * ### Pattern
 * ```ts
 * import { StyleSheet } from 'react-native';
 * import { theme } from '../design';
 *
 * // At module scope — StyleSheet.create validates and flattens at startup
 * const styles = StyleSheet.create({
 *     container: {
 *         flex: 1,
 *         backgroundColor: theme.colors.semantic.background,
 *         padding: theme.spacing[4],
 *     },
 *     title: {
 *         fontFamily: theme.typography.fontFamily.heading,
 *         fontSize: theme.typography.semantic.h2,
 *         fontWeight: '700',
 *         color: theme.colors.neutral[700],
 *         lineHeight: theme.lineHeightFor(theme.typography.semantic.h2, 'tight'),
 *     },
 *     button: {
 *         backgroundColor: theme.colors.accent[500],
 *         borderRadius: theme.radius.semantic.button,
 *         paddingVertical: theme.spacing[3],
 *         paddingHorizontal: theme.spacing[6],
 *     },
 * });
 * ```
 *
 * ### Rules
 * - `StyleSheet.create` must be called at module scope (not inside components),
 *   so RN can validate and cache styles at startup.
 * - Do NOT import `@repo/tailwind-config` or `@repo/icons` (ADR-033).
 * - Do NOT use `oklch()`, `rgb()` strings, or CSS expressions — only hex or
 *   the numeric tokens exported from this module.
 * - For `fontWeight`, cast to the string literal union RN expects:
 *   `fontWeight: String(theme.typography.fontWeight.bold) as '700'`
 *   — or use a string literal directly `'700'` when the value is statically
 *   known. Never pass a bare `number` as `fontWeight`.
 */

import { colors } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';
import { lineHeightFor, typography } from './typography';

/**
 * Aggregated Hospeda mobile design system theme.
 *
 * Combines all token sets (colors, typography, spacing, radius) into a single
 * object for convenient destructuring or direct access. Also exposes the
 * `lineHeightFor` helper so callers can import everything from one symbol.
 *
 * @example
 * ```ts
 * import { theme } from '../design';
 *
 * // Access individual token sets
 * const primary = theme.colors.river[500];        // '#3885f9'
 * const bodySize = theme.typography.semantic.body; // 16
 * const cardPadding = theme.spacing[6];            // 24
 * const cardRadius = theme.radius.semantic.card;   // 24
 *
 * // Compute absolute line-height
 * const titleLineHeight = theme.lineHeightFor(32, 'tight'); // 38
 * ```
 */
export const theme = {
    colors,
    typography,
    spacing,
    radius,
    /** @see lineHeightFor in typography.ts */
    lineHeightFor
} as const;

export { lineHeightFor };
