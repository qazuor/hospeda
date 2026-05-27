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

// ============================================================================
// Semantic palettes — canonical 500 values
//
// Sourced from apps/web/src/styles/global.css :root block. Note: values
// intentionally differ from doc 05 §5.1's post-V1 targets (e.g. doc 05
// proposes success oklch(0.62 0.15 150) while web has oklch(0.58 0.15 150)).
// We anchor to web's current state so the Phase 2 pixel-diff gate stays
// at 0. Tightening the values to doc 05's targets is a post-V1 refinement.
//
// `danger` is sourced from web's `--destructive` token — the package uses
// the more conventional "danger" name; web's `--destructive` alias is
// preserved in the web theme mapping (T-153-14).
// ============================================================================

/**
 * Success — confirmations, positive states. Hue 150 (green, distinct from
 * forest's 155 to avoid brand confusion). Web token `--success`.
 */
export const success: Palette = deriveShades({ l: 0.58, c: 0.15, h: 150 });

/**
 * Warning — attention required, non-blocking concerns. Hue 85 (amber,
 * close to sand's 75 but slightly cooler). Web token `--warning`.
 */
export const warning: Palette = deriveShades({ l: 0.75, c: 0.18, h: 85 });

/**
 * Danger — destructive actions, errors. Hue 27.325 (red-orange, not pure
 * red). Web token `--destructive` (kept as alias in the web theme).
 */
export const danger: Palette = deriveShades({ l: 0.577, c: 0.245, h: 27.325 });

/**
 * Info — informational notices, neutral feedback. Hue 259 (river-blue —
 * web reuses the brand primary hue for info contexts). Web token `--info`.
 */
export const info: Palette = deriveShades({ l: 0.63, c: 0.19, h: 259 });

export const semanticPalettes = { success, warning, danger, info } as const;
export type SemanticPaletteName = keyof typeof semanticPalettes;

// ============================================================================
// Accommodation-type palettes — canonical 500 values
//
// These five palettes exist purely to give each of the 10 accommodation
// types its OWN distinct hue. Five of the ten types reuse existing brand /
// semantic palettes (hotel→accent, apartment→river, house→forest,
// camping→sand, motel→danger); the remaining five need hues that none of the
// brand/semantic palettes cover. Canonical 500 values are product-owner
// approved and tuned to sit alongside the existing palettes' lightness /
// chroma feel (mid lightness ~0.55-0.65, moderate chroma).
//
// They are aggregated SEPARATELY in `accommodationTypePalettes` and then
// folded into the master `palettes` aggregate so the CSS generator emits a
// `--palette-<name>-<shade>` ladder for each — which the per-type semantic
// tokens (`--accommodation-type-<type>`) reference via `var()`.
// ============================================================================

/** Teal — country houses. Hue 185 (blue-green, distinct from forest 155). */
export const teal: Palette = deriveShades({ l: 0.6, c: 0.1, h: 185 });

/** Cyan — hostels. Hue 220 (sits between river 259 and teal 185). */
export const cyan: Palette = deriveShades({ l: 0.65, c: 0.12, h: 220 });

/** Terracotta — cabins. Hue 40 (warm clay, between danger 27 and accent 55). */
export const terracotta: Palette = deriveShades({ l: 0.58, c: 0.12, h: 40 });

/** Rose — rooms. Hue 350 (pink-red, distinct from danger's red-orange 27). */
export const rose: Palette = deriveShades({ l: 0.62, c: 0.16, h: 350 });

/** Purple — resorts. Hue 310 (magenta-purple, the only purple in the system). */
export const purple: Palette = deriveShades({ l: 0.55, c: 0.17, h: 310 });

export const accommodationTypePalettes = { teal, cyan, terracotta, rose, purple } as const;
export type AccommodationTypePaletteName = keyof typeof accommodationTypePalettes;

// ============================================================================
// Neutral grays — 10 shades, chroma 0, hue 0
//
// Per doc 05 §5.1 — a true achromatic ladder used as the base for
// backgrounds, borders, muted text. Web's `--core-background`,
// `--core-foreground`, `--core-card`, `--muted`, `--border` etc. compose
// from these shades in the theme mapping (T-153-14).
//
// The lightness ladder is NOT mechanically derived — doc 05 §5.1 specifies
// hand-tuned stops (0.985 / 0.95 / 0.9 / 0.83 / 0.7 / 0.55 / 0.42 / 0.3 /
// 0.18 / 0.1) that intentionally cluster more values at the light end
// where UI surfaces typically need finer granularity.
// ============================================================================

export const neutral: Palette = Object.freeze({
    50: { l: 0.985, c: 0, h: 0 },
    100: { l: 0.95, c: 0, h: 0 },
    200: { l: 0.9, c: 0, h: 0 },
    300: { l: 0.83, c: 0, h: 0 },
    400: { l: 0.7, c: 0, h: 0 },
    500: { l: 0.55, c: 0, h: 0 },
    600: { l: 0.42, c: 0, h: 0 },
    700: { l: 0.3, c: 0, h: 0 },
    800: { l: 0.18, c: 0, h: 0 },
    900: { l: 0.1, c: 0, h: 0 }
});

// ============================================================================
// Master palette aggregate
// ============================================================================

export const palettes = {
    ...brandPalettes,
    ...semanticPalettes,
    ...accommodationTypePalettes,
    neutral
} as const;
export type PaletteName = keyof typeof palettes;

// ============================================================================
// Web-specific extras — single OKLCH primitives that do not fit a palette
// family (no shade ladder makes sense). All values are LIGHT-theme defaults
// from apps/web/src/styles/global.css :root. Dark-theme overrides for
// these tokens are applied via the dark theme mapping (T-153-14/T-153-15);
// they do not live in this module.
// ============================================================================

/**
 * Lighter complement to `sky` (same hue 259, higher lightness). Web token
 * `--hospeda-sky-light`. NOT a shade of `sky` — it's hand-tuned for
 * backgrounds where sky-500 is too saturated.
 */
export const skyLight: OKLCH = { l: 0.88, c: 0.06, h: 259 };

/**
 * Secondary brand surface (very pale near-white blue) + its readable
 * foreground. Used for muted card variants. Web tokens `--brand-secondary`
 * and `--brand-secondary-foreground`.
 */
export const brandSecondary: OKLCH = { l: 0.96, c: 0.02, h: 236 };
export const brandSecondaryForeground: OKLCH = { l: 0.26, c: 0.06, h: 255 };

/**
 * Tertiary brand surface (pale green tint). Web token `--brand-tertiary`.
 */
export const brandTertiary: OKLCH = { l: 0.92, c: 0.03, h: 155 };

/**
 * Rating star fill — warm gold for reviews / scores. Web token `--rating-star`.
 */
export const ratingStar: OKLCH = { l: 0.82, c: 0.19, h: 95 };

/**
 * Avatar gradient stops for the "social proof" hero section. 4 gradients
 * × 2 stops (from / to). Web tokens `--avatar-{1..4}-{from,to}`.
 *
 * Each gradient is a distinct hue (blue / amber / cyan / green) so the
 * mosaic of avatars reads as varied without any one stealing focus.
 */
export const avatarGradients = {
    1: { from: { l: 0.25, c: 0.08, h: 255 }, to: { l: 0.36, c: 0.12, h: 255 } },
    2: { from: { l: 0.65, c: 0.15, h: 75 }, to: { l: 0.78, c: 0.17, h: 80 } },
    3: { from: { l: 0.5, c: 0.1, h: 195 }, to: { l: 0.65, c: 0.13, h: 195 } },
    4: { from: { l: 0.42, c: 0.12, h: 155 }, to: { l: 0.62, c: 0.16, h: 155 } }
} as const satisfies Record<1 | 2 | 3 | 4, { readonly from: OKLCH; readonly to: OKLCH }>;

/**
 * Chart series colors — 5 discrete hues for data visualizations. NOT
 * derived from any palette: web hand-picked these to maximize visual
 * separation across chart series. Web tokens `--chart-1` through `--chart-5`.
 *
 * Index 0 corresponds to `--chart-1`, index 4 to `--chart-5`.
 */
export const chartColors = [
    { l: 0.63, c: 0.19, h: 259 }, // chart-1 — river blue
    { l: 0.6, c: 0.14, h: 155 }, // chart-2 — forest green (slightly lighter)
    { l: 0.7, c: 0.18, h: 55 }, // chart-3 — accent orange
    { l: 0.75, c: 0.1, h: 190 }, // chart-4 — cyan
    { l: 0.5, c: 0.08, h: 240 } // chart-5 — deep blue
] as const satisfies ReadonlyArray<OKLCH>;

/**
 * Surface colors — background variants for warm / dark / elevated contexts.
 * Web tokens `--surface-warm`, `--surface-warm-foreground`, `--surface-dark`,
 * `--surface-dark-foreground`, `--surface-elevated`.
 *
 * The `*-foreground` values are pre-chosen readable text colors for each
 * surface, paired so consumers don't have to compute contrast at runtime.
 */
export const surfaces = {
    warm: { l: 0.95, c: 0.03, h: 250 },
    warmForeground: { l: 0.35, c: 0.03, h: 250 },
    dark: { l: 0.15, c: 0.02, h: 160 },
    darkForeground: { l: 0.92, c: 0.01, h: 210 },
    elevated: { l: 1, c: 0, h: 0 }
} as const satisfies Record<string, OKLCH>;
