/**
 * @file index.ts
 * @description Public API for @repo/design-tokens. SPEC-153 T-153-18.
 *
 * Consumers (apps/web, apps/admin, any future shared component package)
 * import named tokens, theme records, and TS types from this entry. The
 * compiled CSS lives at `./tokens.css` (separate export condition), and the
 * extracted seed manifest at `./seed/web-baseline.json` is exposed for
 * downstream tooling that needs to introspect web's frozen baseline.
 *
 * Exports are grouped by source module — wildcards re-export every public
 * symbol of each module. No symbols collide today (verified by tsc), so the
 * wildcard form stays maintainable as token modules grow without touching
 * this file.
 *
 *   // Tokens — primitives and structured constants
 *   import { river, palettes, formatOKLCH, type OKLCH } from '@repo/design-tokens';
 *   import { semanticTypography, fontFamily } from '@repo/design-tokens';
 *   import { spacing, semanticSpacing } from '@repo/design-tokens';
 *   import { radiusBase, radiusScale, radiusSemantic } from '@repo/design-tokens';
 *   import { shadowSemantic, shadowScale } from '@repo/design-tokens';
 *   import { motionDuration, webDuration } from '@repo/design-tokens';
 *   import { zIndex, layoutChrome } from '@repo/design-tokens';
 *
 *   // Themes — flat records keyed by CSS custom-property name (no `--`)
 *   import { webLight, webDark, adminLight, adminDark } from '@repo/design-tokens';
 *   import type { Theme, ThemeValue } from '@repo/design-tokens';
 */

// ============================================================================
// Tokens
// ============================================================================

export * from './tokens/colors.js';
export * from './tokens/layout.js';
export * from './tokens/motion.js';
export * from './tokens/radius.js';
export * from './tokens/shadows.js';
export * from './tokens/spacing.js';
export * from './tokens/typography.js';
export * from './tokens/z-index.js';

// ============================================================================
// Themes
// ============================================================================

export * from './themes/types.js';
export { webLight } from './themes/web-light.js';
export { webDark } from './themes/web-dark.js';
export { adminLight } from './themes/admin-light.js';
export { adminDark } from './themes/admin-dark.js';

// ============================================================================
// Package metadata
// ============================================================================

export const PACKAGE_NAME = '@repo/design-tokens';
export const PACKAGE_VERSION = '0.0.0';
export const SPEC_REF = 'SPEC-153';
