/**
 * @file colors.ts
 * @description Brand color palettes for SPEC-153.
 *
 * Each palette holds 10 shades (50-900) derived from a single canonical
 * value at shade 500. The canonical values are anchored to web's current
 * tokens in apps/web/src/styles/global.css (verified byte-for-byte
 * against the seed manifest at packages/design-tokens/seed/web-baseline.json
 * and against doc 05 §5.1). Anchoring is required so Phase 2's pixel-diff
 * gate stays at 0 when web migrates to consume this package.
 *
 * Semantic palettes (success/warning/danger/info), neutral grays, and
 * web's extra non-palette tokens (footer-*, avatar gradients, charts,
 * surfaces) live in T-153-07's extension of this module.
 *
 * Shade derivation algorithm per doc 05 §5.1:
 *   - Lightness moves linearly: 0.99 (50) → canonical.l (500) → 0.10 (900).
 *   - Chroma scales: full at 500, ~50% at 50/900 (more grey at extremes).
 *   - Hue is locked across all 10 shades.
 */

// ============================================================================
// Types
// ============================================================================

/** A single color in the OKLCH color space — lightness, chroma, hue. */
export type OKLCH = {
    readonly l: number;
    readonly c: number;
    readonly h: number;
};

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type Shade = (typeof SHADES)[number];

export type Palette = Readonly<Record<Shade, OKLCH>>;

// ============================================================================
// Derivation algorithm — doc 05 §5.1
// ============================================================================

/** Maps each shade key to its index in [0, 9] (50 → 0, 900 → 9). */
const SHADE_POSITIONS: Readonly<Record<Shade, number>> = {
    50: 0,
    100: 1,
    200: 2,
    300: 3,
    400: 4,
    500: 5,
    600: 6,
    700: 7,
    800: 8,
    900: 9
};

/** Lightness ceiling at shade 50 — per doc 05 §5.1. */
const EXTREME_LIGHT = 0.99;
/** Lightness floor at shade 900 — per doc 05 §5.1. */
const EXTREME_DARK = 0.1;
/** Chroma at the extreme shades is reduced to this fraction of canonical (~50%). */
const CHROMA_FLOOR_RATIO = 0.5;

/** Position of the canonical shade in the [0, 9] scale. */
const CANONICAL_POSITION = SHADE_POSITIONS[500];
/** Distance from 500 to 50, used to normalize light-side scaling. */
const STEPS_UP = CANONICAL_POSITION;
/** Distance from 500 to 900, used to normalize dark-side scaling. */
const STEPS_DOWN = SHADE_POSITIONS[900] - CANONICAL_POSITION;

/**
 * Derive a 10-shade palette from a canonical 500 OKLCH value.
 *
 * The returned object is frozen — palettes are static constants and
 * downstream code should not mutate individual shades. Use the helper
 * `formatOKLCH(palette[500])` to serialize a shade to its CSS string.
 *
 * @param canonical - The OKLCH triple that defines shade 500.
 * @returns A `Palette` with all 10 shades populated.
 */
export function deriveShades(canonical: OKLCH): Palette {
    const result = {} as Record<Shade, OKLCH>;
    for (const shade of SHADES) {
        const position = SHADE_POSITIONS[shade];
        const l =
            position <= CANONICAL_POSITION
                ? EXTREME_LIGHT - (EXTREME_LIGHT - canonical.l) * (position / STEPS_UP)
                : canonical.l -
                  (canonical.l - EXTREME_DARK) * ((position - CANONICAL_POSITION) / STEPS_DOWN);
        const distance =
            position < CANONICAL_POSITION
                ? (CANONICAL_POSITION - position) / STEPS_UP
                : (position - CANONICAL_POSITION) / STEPS_DOWN;
        const c = canonical.c * (1 - CHROMA_FLOOR_RATIO * distance);
        result[shade] = { l, c, h: canonical.h };
    }
    return Object.freeze(result);
}

/**
 * Round an OKLCH component to 3 decimal places. Eliminates IEEE-754 noise
 * (e.g. `0.99 - 0.36 * 4/5` → `0.7019999...`) without changing values that
 * are already exact (`0.63` stays `0.63`, not `0.630`).
 */
function roundComponent(value: number): number {
    return Math.round(value * 1000) / 1000;
}

/**
 * Format an OKLCH value as a CSS `oklch(L C H)` string with components
 * rounded to 3 decimals and trailing zeros stripped. Matches the value
 * shape used by web's current global.css.
 */
export function formatOKLCH(value: OKLCH): string {
    const l = roundComponent(value.l);
    const c = roundComponent(value.c);
    const h = roundComponent(value.h);
    return `oklch(${l} ${c} ${h})`;
}

// ============================================================================
// Brand palettes — canonical 500 values
//
// Sourced from apps/web/src/styles/global.css (the :root block, captured
// in seed/web-baseline.json under categories.light.core-palette + .hospeda-brand-colors).
// Verified byte-for-byte against doc 05 §5.1 — these are the "anchored
// to web's current values per Eje 3 safety" canonical values.
// ============================================================================

/**
 * River — primary brand blue. Hue 259. Web uses shade 500 as its
 * `--brand-primary` and `--hospeda-river`. Admin will use shade 600
 * (per doc 05 §3 Eje 3 admin density adjustment).
 */
export const river: Palette = deriveShades({ l: 0.63, c: 0.19, h: 259 });

/**
 * Sky — airy blue, same hue as river. Hue 259. Used for hover surfaces,
 * subtle backgrounds. Web token `--hospeda-sky`.
 */
export const sky: Palette = deriveShades({ l: 0.8, c: 0.08, h: 259 });

/**
 * Forest — brand green for gastronomy / nature contexts. Hue 155.
 * Web token `--hospeda-forest`.
 */
export const forest: Palette = deriveShades({ l: 0.5, c: 0.14, h: 155 });

/**
 * Sand — warm yellow-gold for crafts / warmth contexts. Hue 75.
 * Web token `--hospeda-sand`. Comment in global.css notes lightness was
 * intentionally lowered from a previous near-white value so badges that
 * reference this at 0.15 alpha remain visible.
 */
export const sand: Palette = deriveShades({ l: 0.7, c: 0.12, h: 75 });

/**
 * Accent — orange-honey for CTAs and highlights. Hue 55. Web token
 * `--brand-accent`.
 */
export const accent: Palette = deriveShades({ l: 0.7, c: 0.18, h: 55 });

// ============================================================================
// Aggregate brand exports
// ============================================================================

export const brandPalettes = { river, sky, forest, sand, accent } as const;
export type BrandPaletteName = keyof typeof brandPalettes;
