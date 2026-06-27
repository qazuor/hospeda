/**
 * @file index.ts
 * @description Mobile design system barrel export for the Hospeda app (T-006/T-007).
 *
 * Exports all token sets and the aggregated `theme` object. Import from this
 * barrel to access any design token in mobile screens and components.
 *
 * ## What's here
 * - `colors` — brand palettes, semantic palettes, neutral grays, semantic aliases.
 * - `typography` — font families, size scale (px), weights, line-height helpers.
 * - `spacing` — numeric px scale (0–96).
 * - `radius` — border-radius tokens resolved to absolute px.
 * - `theme` — aggregated object that combines all of the above plus helpers.
 * - `lineHeightFor` — helper to compute absolute RN line-height from a ratio.
 *
 * ## Forbidden imports (ADR-034)
 * Do NOT import from these packages anywhere in `apps/mobile`:
 * - `@repo/tailwind-config` — CSS-only, blocked by `biome.json`
 * - `@repo/icons` — DOM SVG package, crashes in React Native
 *
 * @example
 * ```ts
 * import { colors, spacing, radius, theme } from '../design';
 * // or, from deeper paths:
 * import { theme } from '../../design';
 * ```
 */

// Colors
export { colors } from './colors';

// Typography
export {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeightFor,
    lineHeightRatio,
    semanticSize,
    typography
} from './typography';
export type {
    FontFamilyName,
    FontSizeKey,
    FontWeightName,
    LineHeightRatioName,
    SemanticSizeKey
} from './typography';

// Spacing
export { spacing } from './spacing';
export type { SpacingKey } from './spacing';

// Radius
export {
    base as radiusBase,
    radius,
    scale as radiusScale,
    semantic as radiusSemantic
} from './radius';
export type { RadiusScaleKey, RadiusSemanticName } from './radius';

// Theme (aggregated object — primary import surface for screens)
export { theme } from './theme';
