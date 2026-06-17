/**
 * @file colors.ts
 * @description Mobile design-system color tokens for Hospeda (T-006).
 *
 * Color values are the Hospeda brand palette ported to React Native.
 * The canonical source of truth is `packages/design-tokens/src/tokens/colors.ts`,
 * which defines palettes in the OKLCH color space. React Native's `StyleSheet`
 * does NOT support `oklch()` — so every value here is a hex string derived
 * from the same OKLCH→sRGB conversion that SPEC-176 baked into the web
 * `tokens.css` sRGB `:root` fallback block.
 *
 * ## Conversion method
 * Each OKLCH triple was converted to sRGB hex using the same algorithm as
 * `packages/design-tokens/src/generators/srgb.ts`:
 *   1. OKLCH → OKLab (via chroma/hue polar-to-cartesian)
 *   2. OKLab → linear sRGB (Bjorn Ottosson matrix)
 *   3. Gamut-map by binary-searching chroma reduction until all channels
 *      are in [0, 1] (matches culori's `clampChroma(..., 'oklch', 'rgb')`)
 *   4. Linear → gamma sRGB (IEC 61966-2-1 transfer function)
 *   5. Round each channel to integer 0–255 → hex
 *
 * Cross-check: `river.500 = '#3885f9'` matches the documented canonical
 * `rgb(56 133 249)` (0x38=56, 0x85=133, 0xf9=249) exactly.
 *
 * Shade derivation replicates `deriveShades()` from `packages/design-tokens`:
 *   - Lightness: linear from 0.99 (shade 50) through canonical.l (shade 500)
 *     to 0.10 (shade 900).
 *   - Chroma: scales from 50 % of canonical at the extremes to 100 % at 500.
 *   - Hue: locked across all shades.
 *
 * DO NOT import `@repo/tailwind-config` here — it is a CSS-only package
 * banned in mobile by `apps/mobile/biome.json` (ADR-034).
 */

// ============================================================================
// Brand palettes — 10-shade ladders (50 → 900)
//
// Canonical 500 OKLCH values from packages/design-tokens/src/tokens/colors.ts.
// ============================================================================

/**
 * River — primary brand blue.
 *
 * Canonical: `oklch(0.63 0.19 259)` → shade 500 = `#3885f9`.
 * Used as `--brand-primary` / `--hospeda-river` on web.
 *
 * @example
 * ```ts
 * color: colors.river[500]  // '#3885f9' — primary CTA text / icon
 * backgroundColor: colors.river[50] // '#fafcff' — tinted surface
 * ```
 */
export const river = {
    50: '#fafcff',
    100: '#d4e5ff',
    200: '#afceff',
    300: '#88b7ff',
    400: '#609eff',
    500: '#3885f9',
    600: '#1c5dbf',
    700: '#003987',
    800: '#001a47',
    900: '#00030f'
} as const;

/**
 * Sky — airy blue, same hue as river (259). Lighter, less saturated.
 *
 * Canonical: `oklch(0.80 0.08 259)` → shade 500 = `#9fbff2`.
 * Used for hover surfaces and subtle tinted backgrounds.
 *
 * @example
 * ```ts
 * backgroundColor: colors.sky[100]  // '#e6f0ff' — very light tinted card
 * ```
 */
export const sky = {
    50: '#fafcff',
    100: '#e6f0ff',
    200: '#d2e4ff',
    300: '#bfd8ff',
    400: '#aeccf9',
    500: '#9fbff2',
    600: '#6e89b2',
    700: '#415677',
    800: '#182840',
    900: '#00030f'
} as const;

/**
 * Forest — brand green for gastronomy / nature contexts.
 *
 * Canonical: `oklch(0.50 0.14 155)` → shade 500 = `#007742`.
 * Used as `--hospeda-forest` on web.
 *
 * @example
 * ```ts
 * color: colors.forest[500]  // '#007742'
 * ```
 */
export const forest = {
    50: '#f4fff7',
    100: '#afecc3',
    200: '#87cfa0',
    300: '#5fb27e',
    400: '#30955d',
    500: '#007742',
    600: '#00572f',
    700: '#00381c',
    800: '#001c0c',
    900: '#000501'
} as const;

/**
 * Sand — warm yellow-gold for crafts / warmth contexts.
 *
 * Canonical: `oklch(0.70 0.12 75)` → shade 500 = `#ca933e`.
 * Used as `--hospeda-sand` on web.
 *
 * @example
 * ```ts
 * color: colors.sand[500]  // '#ca933e'
 * ```
 */
export const sand = {
    50: '#fffbf6',
    100: '#ffe4c0',
    200: '#f6ce97',
    300: '#e8ba7b',
    400: '#d9a65e',
    500: '#ca933e',
    600: '#95671c',
    700: '#624000',
    800: '#301d00',
    900: '#060300'
} as const;

/**
 * Accent — orange-honey for CTAs and highlights.
 *
 * Canonical: `oklch(0.70 0.18 55)` → shade 500 = `#ed7b00`.
 * Used as `--brand-accent` on web.
 *
 * @example
 * ```ts
 * backgroundColor: colors.accent[500]  // '#ed7b00' — primary CTA button
 * ```
 */
export const accent = {
    50: '#fffbf8',
    100: '#ffe2cf',
    200: '#ffc9a4',
    300: '#ffad75',
    400: '#fd913b',
    500: '#ed7b00',
    600: '#ac5700',
    700: '#6f3600',
    800: '#371800',
    900: '#080200'
} as const;

// ============================================================================
// Semantic palettes — confirmations, warnings, errors, info
//
// Canonical 500 OKLCH values from packages/design-tokens/src/tokens/colors.ts.
// ============================================================================

/**
 * Success — confirmations, positive states.
 *
 * Canonical: `oklch(0.58 0.15 150)` → shade 500 = `#1b9247`.
 *
 * @example
 * ```ts
 * color: colors.success[500]  // '#1b9247' — success message text
 * backgroundColor: colors.success[50]  // '#f5fff6' — success alert background
 * ```
 */
export const success = {
    50: '#f5fff6',
    100: '#b6f2c1',
    200: '#94daa2',
    300: '#71c183',
    400: '#4ca965',
    500: '#1b9247',
    600: '#006b2e',
    700: '#00451b',
    800: '#00220a',
    900: '#000501'
} as const;

/**
 * Warning — attention required, non-blocking concerns.
 *
 * Canonical: `oklch(0.75 0.18 85)` → shade 500 = `#daa500`.
 *
 * @example
 * ```ts
 * color: colors.warning[600]  // '#9d7600' — warning text (better contrast)
 * backgroundColor: colors.warning[50]  // '#fffbf4'
 * ```
 */
export const warning = {
    50: '#fffbf4',
    100: '#ffe9bd',
    200: '#ffd680',
    300: '#f7c44e',
    400: '#ecb30b',
    500: '#daa500',
    600: '#9d7600',
    700: '#644a00',
    800: '#302200',
    900: '#050300'
} as const;

/**
 * Danger — destructive actions, errors.
 *
 * Canonical: `oklch(0.577 0.245 27.325)` → shade 500 = `#e40016`.
 * Maps to web's `--destructive` token.
 *
 * @example
 * ```ts
 * color: colors.danger[500]  // '#e40016' — error text
 * backgroundColor: colors.danger[50]  // '#fffbfa'
 * ```
 */
export const danger = {
    50: '#fffbfa',
    100: '#ffd5cf',
    200: '#ffada3',
    300: '#ff8073',
    400: '#fc453e',
    500: '#e40016',
    600: '#a7000d',
    700: '#6e0006',
    800: '#3a0001',
    900: '#0d0000'
} as const;

/**
 * Info — informational notices, neutral feedback.
 *
 * Canonical: `oklch(0.63 0.19 259)` → shade 500 = `#3885f9` (same hue as river).
 * Maps to web's `--info` token.
 */
export const info = {
    50: '#fafcff',
    100: '#d4e5ff',
    200: '#afceff',
    300: '#88b7ff',
    400: '#609eff',
    500: '#3885f9',
    600: '#1c5dbf',
    700: '#003987',
    800: '#001a47',
    900: '#00030f'
} as const;

// ============================================================================
// Neutral grays — achromatic ladder (c=0, h=0)
//
// Hand-tuned lightness stops per doc 05 §5.1 (clusters more values at
// the light end where UI surfaces need finer granularity).
// Canonical source: packages/design-tokens/src/tokens/colors.ts `neutral`.
// ============================================================================

/**
 * Neutral grays — achromatic (c=0, h=0), 10-shade ladder.
 *
 * Lightness stops are hand-tuned per doc 05 §5.1 and differ from a
 * mechanical linear ladder to give more granularity in the light range.
 *
 * | Shade | Lightness | Hex       | Usage example          |
 * |-------|-----------|-----------|------------------------|
 * | 50    | 0.985     | `#fafafa` | Page background        |
 * | 100   | 0.950     | `#eeeeee` | Card border            |
 * | 200   | 0.900     | `#dedede` | Divider                |
 * | 300   | 0.830     | `#c7c7c7` | Placeholder text       |
 * | 400   | 0.700     | `#9e9e9e` | Secondary text         |
 * | 500   | 0.550     | `#717171` | Body text (accessible) |
 * | 600   | 0.420     | `#4d4d4d` | Strong body text       |
 * | 700   | 0.300     | `#2e2e2e` | Heading                |
 * | 800   | 0.180     | `#121212` | Dark surface           |
 * | 900   | 0.100     | `#030303` | Near-black             |
 *
 * @example
 * ```ts
 * color: colors.neutral[700]       // '#2e2e2e' — heading text
 * borderColor: colors.neutral[200] // '#dedede' — card border
 * ```
 */
export const neutral = {
    50: '#fafafa',
    100: '#eeeeee',
    200: '#dedede',
    300: '#c7c7c7',
    400: '#9e9e9e',
    500: '#717171',
    600: '#4d4d4d',
    700: '#2e2e2e',
    800: '#121212',
    900: '#030303'
} as const;

// ============================================================================
// Semantic single-value tokens — surfaces, text roles, brand extras
//
// Sourced from web-specific OKLCH primitives in packages/design-tokens.
// ============================================================================

/**
 * Semantic color tokens for common UI roles.
 *
 * These map directly from `packages/design-tokens/src/tokens/colors.ts`
 * single-value (non-palette) exports. Values are OKLCH→hex conversions
 * using the same sRGB gamut-mapping pipeline as the web fallback block.
 *
 * @example
 * ```ts
 * backgroundColor: colors.semantic.background  // '#ffffff'
 * color: colors.semantic.textPrimary            // '#030303'
 * borderColor: colors.semantic.border           // '#dedede'
 * ```
 */
export const semantic = {
    // Backgrounds / surfaces
    /** Pure white — page and card backgrounds in light mode. */
    background: '#ffffff',
    /** Warm tinted surface (`oklch(0.95 0.03 250)`) — subtle alternate background. */
    surfaceWarm: '#e2f0ff',
    /** Dark surface (`oklch(0.15 0.02 160)`) — inverted card / hero darkening. */
    surfaceDark: '#040e08',
    /** Foreground on dark surface (`oklch(0.92 0.01 210)`). */
    surfaceDarkForeground: '#dde6e8',

    // Text roles (mapped from neutral palette)
    /** Primary text — near-black. Use `neutral[900]` or this alias. */
    textPrimary: '#030303',
    /** Secondary text — mid-gray for subtitles and body copy. */
    textSecondary: '#717171',
    /** Muted / meta text — lighter gray for timestamps, captions. */
    textMuted: '#9e9e9e',
    /** Inverted text on dark surfaces. */
    textInverted: '#ffffff',

    // Borders / dividers
    /** Default border — card and input borders. Maps to `neutral[200]`. */
    border: '#dedede',
    /** Subtle divider — section separators. Maps to `neutral[100]`. */
    divider: '#eeeeee',

    // Brand extras
    /** Sky-light — very pale blue tint (`oklch(0.88 0.06 259)`). */
    skyLight: '#c1d9ff',
    /** Secondary brand surface — near-white blue (`oklch(0.96 0.02 236)`). */
    brandSecondary: '#e6f4fe',
    /** Readable foreground on brand-secondary surfaces (`oklch(0.26 0.06 255)`). */
    brandSecondaryForeground: '#0e2440',
    /** Tertiary brand surface — pale green tint (`oklch(0.92 0.03 155)`). */
    brandTertiary: '#d6ebdc',
    /** Rating star fill — warm gold (`oklch(0.82 0.19 95)`). */
    ratingStar: '#e6c100'
} as const;

// ============================================================================
// Master colors aggregate
// ============================================================================

/**
 * Complete mobile color token set for the Hospeda design system.
 *
 * All values are hex strings compatible with React Native `StyleSheet`.
 * Sourced from `packages/design-tokens/src/tokens/colors.ts` (OKLCH→sRGB
 * conversion using the SPEC-176 gamut-mapping pipeline).
 *
 * ## Usage with StyleSheet.create
 * ```ts
 * import { StyleSheet } from 'react-native';
 * import { colors } from '../design';
 *
 * const styles = StyleSheet.create({
 *   container: { backgroundColor: colors.semantic.background },
 *   title:     { color: colors.neutral[700] },
 *   cta:       { backgroundColor: colors.accent[500] },
 *   error:     { color: colors.danger[500] },
 * });
 * ```
 */
export const colors = {
    river,
    sky,
    forest,
    sand,
    accent,
    success,
    warning,
    danger,
    info,
    neutral,
    semantic
} as const;
