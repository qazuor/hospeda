/**
 * @file types/culori.d.ts
 * @description Minimal ambient type declarations for culori 4.x (build-time only).
 *
 * Culori 4.x ships its types as JSDoc annotations on ESM source files, not as
 * pre-compiled `.d.ts` artifacts. TypeScript's `moduleResolution: "bundler"`
 * resolves the package to `src/index.js` and finds no declaration file,
 * producing TS7016. This ambient module declaration provides the exact subset
 * of culori's API surface that `src/generators/srgb.ts` uses so that
 * `pnpm typecheck` passes without requiring `allowJs` or `checkJs`.
 *
 * Only the three symbols imported by srgb.ts are declared:
 * - `clampChroma` — CSS Color Level 4 gamut mapping by chroma reduction.
 * - `converter`   — Factory returning a function that converts any color to
 *                   a specific color space (we use `converter('rgb')`).
 * - `Oklch`       — Culori's oklch color object type.
 * - `Rgb`         — Culori's rgb color object type.
 *
 * This file is intentionally NOT a full re-declaration of culori's public API.
 * If future code in this package needs more culori symbols, add them here.
 *
 * SPEC-176 / T-002 — culori is a devDependency of @repo/design-tokens only.
 */

declare module 'culori' {
    /** Culori color in OKLCH space. */
    export interface Oklch {
        readonly mode: 'oklch';
        l: number;
        c: number;
        h: number;
        alpha?: number;
    }

    /** Culori color in linear sRGB space. */
    export interface Rgb {
        readonly mode: 'rgb';
        r: number;
        g: number;
        b: number;
        alpha?: number;
    }

    /** Union of all culori color objects (simplified to the types we use). */
    export type Color = Oklch | Rgb;

    /**
     * Gamut-map a color by reducing chroma until the color lies within the
     * target gamut. Preserves lightness and hue.
     *
     * @param color  - Source color (any culori-supported mode).
     * @param mode   - Color space used for chroma reduction (e.g. `'oklch'`).
     * @param gamut  - Target gamut to map into (e.g. `'rgb'` for sRGB).
     * @returns Gamut-mapped color in the same mode as the input.
     */
    export function clampChroma(
        color: Color | Record<string, unknown>,
        mode: string,
        gamut: string
    ): Oklch;

    /**
     * Create a converter function that converts any color to the target mode.
     *
     * @param mode - Target color space (e.g. `'rgb'`).
     * @returns A function that accepts any culori color and returns a color in
     *   the target mode (or `undefined` if conversion is not possible).
     */
    export function converter(mode: 'rgb'): (color: Color | Record<string, unknown>) => Rgb;
    export function converter(mode: string): (color: Color | Record<string, unknown>) => Color;
}
