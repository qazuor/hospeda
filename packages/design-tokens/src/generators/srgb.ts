/**
 * @file generators/srgb.ts
 * @description SPEC-176 — Build-time OKLCH→sRGB converter.
 *
 * This module is intentionally NOT exported through `src/index.ts`. It exists
 * solely for use by the design-tokens generator pipeline (generate-css.ts and
 * scripts that call it). Keeping this file out of the runtime export surface
 * prevents culori from being bundled into consumer packages (apps/web, apps/admin)
 * that import `@repo/design-tokens` at runtime.
 *
 * Bundle-leak mitigation rationale (option b over option a):
 * - Option a (dynamic import): makes formatSRGB() async, which would force
 *   buildCSS() async, complicating all callers including the Vitest suite.
 * - Option b (generator-only module, NOT re-exported by index.ts): keeps
 *   formatSRGB() synchronous and buildCSS() synchronous. culori is only
 *   reachable at build time when generate-css.ts is invoked via `tsx`. At
 *   runtime (consumer bundle), index.ts does not reference this module, so
 *   culori is never included in the consumer module graph.
 *
 * Gamut-mapping approach:
 * - Uses culori's `clampChroma(color, 'oklch', 'rgb')` — CSS Color Level 4
 *   gamut mapping toward the sRGB gamut (not P3). Chrome 109's rendering
 *   engine handles sRGB natively; P3 support is not reliable at that version.
 * - After gamut-mapping, converts to sRGB via `converter('rgb')` and rounds
 *   each channel to an integer 0–255.
 * - Space-separated integer syntax `rgb(R G B)` is valid CSS Color 4 (Chrome
 *   65+) and correctly interpreted by Chrome 109 for fallback values.
 */

import { clampChroma, converter } from 'culori';

import type { OKLCH } from '../tokens/colors.js';

/** Culori rgb() converter — created once at module load, reused across calls. */
const toRgb = converter('rgb');

/**
 * Convert an OKLCH value to a CSS `rgb(R G B)` string via CSS Color Level 4
 * sRGB gamut mapping. Components are integers in [0, 255].
 *
 * Used at build time by `generate-css.ts` to emit sRGB fallback declarations
 * for browsers that do not support `oklch(from ...)` relative colors (SPEC-176).
 *
 * Gamut mapping uses culori's `clampChroma` targeting the `'rgb'` (sRGB) gamut,
 * not `'p3'` — because the fallback path is for Chrome 109, which lacks reliable
 * P3 support. In-gamut colors pass through unchanged; out-of-gamut colors are
 * reduced in chroma until they fit within sRGB while preserving lightness and hue.
 *
 * After gamut mapping the result is converted to linear sRGB, each channel is
 * clamped to [0, 1] as a guard against floating-point noise, and multiplied by
 * 255 with rounding.
 *
 * @param value - OKLCH triple `{l, c, h}` to convert.
 * @returns CSS `rgb(R G B)` string with space-separated integer components,
 *   e.g. `"rgb(56 133 249)"`. No alpha component — callers append `/ ALPHA`
 *   when needed (e.g. for alpha-variant tokens: `rgb(56 133 249) / 0.15`).
 *
 * @example
 * ```ts
 * // Brand-primary river blue
 * formatSRGB({ l: 0.63, c: 0.19, h: 259 })
 * // => "rgb(56 133 249)"
 *
 * // Pure mid-gray (achromatic)
 * formatSRGB({ l: 0.6, c: 0.0, h: 0 })
 * // => "rgb(128 128 128)"
 *
 * // High-chroma out-of-gamut (gamut-mapped to sRGB)
 * formatSRGB({ l: 0.7, c: 0.4, h: 140 })
 * // => "rgb(58 189 0)" — chroma reduced to fit sRGB
 * ```
 */
export function formatSRGB(value: OKLCH): string {
    // 1. Build a culori-compatible oklch object from the OKLCH triple.
    const oklchColor = { mode: 'oklch' as const, l: value.l, c: value.c, h: value.h };

    // 2. Gamut-map toward sRGB (not P3) using CSS Color Level 4 chroma reduction.
    //    clampChroma preserves lightness and hue, reducing chroma iteratively
    //    until the color fits within the target gamut's boundaries.
    const gamutMapped = clampChroma(oklchColor, 'oklch', 'rgb');

    // 3. Convert the gamut-mapped oklch value to linear sRGB channels [0, 1].
    const rgbColor = toRgb(gamutMapped);

    // 4. Clamp channels to [0, 1] as a floating-point noise guard, then scale
    //    to integer 0–255 for standard CSS `rgb()` integer syntax.
    const r = Math.round(Math.max(0, Math.min(1, rgbColor?.r ?? 0)) * 255);
    const g = Math.round(Math.max(0, Math.min(1, rgbColor?.g ?? 0)) * 255);
    const b = Math.round(Math.max(0, Math.min(1, rgbColor?.b ?? 0)) * 255);

    // 5. Return space-separated integer syntax (CSS Color 4, Chrome 65+).
    //    Comma-separated legacy syntax (rgb(R, G, B)) is intentionally NOT used
    //    to keep the output consistent with modern CSS and the @supports pattern.
    return `rgb(${r} ${g} ${b})`;
}
