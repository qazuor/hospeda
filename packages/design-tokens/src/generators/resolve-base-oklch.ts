/**
 * @file generators/resolve-base-oklch.ts
 * @description SPEC-176 T-006 — Shared two-level base-OKLCH resolver.
 *
 * Used by both `emit-variant-tokens.ts` (CSS emitter) and
 * `gamut-fidelity.test.ts` (fidelity guard) to convert a variant-token base
 * name to its OKLCH triple. Both sites previously contained independent
 * one-level resolver copies; this module unifies them so they cannot diverge.
 *
 * ## Resolution strategy (three levels, in order)
 *
 * 1. **white special case** — The CSS-wide `white` keyword is not a theme
 *    token. Resolves to a fixed achromatic triple `{ l: 1, c: 0, h: 0 }`.
 *
 * 2. **Direct theme lookup** — If `theme[base]` is an OKLCH object, return it.
 *
 * 3. **One-level var() indirection** — If `theme[base]` is a `var(--NAME)`
 *    string, look up `NAME` in the same theme:
 *    a. If `theme[NAME]` is OKLCH, return it. (Existing tokens like
 *       `footer-fg` → `var(--surface-dark-foreground)` which IS OKLCH.)
 *    b. If not, attempt a **palette lookup**: parse `NAME` as
 *       `palette-<paletteName>-<shade>` (e.g. `palette-accent-500`) and return
 *       `palettes[paletteName][shade]` if it exists. This is the new path that
 *       enables domain tokens (accommodation-type-hotel, etc.) to resolve:
 *       `accommodation-type-hotel` → `var(--palette-accent-500)` → `accent[500]`.
 *
 * 4. **Throw** — If all strategies are exhausted, throw with a descriptive
 *    error so the build fails loudly rather than emitting bad CSS.
 *
 * @see emit-variant-tokens.ts — consumes `resolveBaseToOklch` in
 *   `buildBaseOklchLookup`.
 * @see gamut-fidelity.test.ts — consumes `resolveBaseToOklch` in `resolveBase`.
 */

import type { Theme } from '../themes/types.js';
import { webLight } from '../themes/web-light.js';
import type { OKLCH, Shade } from '../tokens/colors.js';
import { SHADES, palettes } from '../tokens/colors.js';

// ============================================================================
// Internal helpers
// ============================================================================

/** Fixed OKLCH for the CSS-wide `white` keyword (matches emit-variant-tokens). */
const WHITE_OKLCH: OKLCH = { l: 1, c: 0, h: 0 };

/**
 * Narrow an unknown value to the OKLCH branch.
 *
 * @param value - Value to test.
 * @returns `true` iff the value has numeric `l`, `c`, `h` fields.
 */
function isOklch(value: unknown): value is OKLCH {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as OKLCH).l === 'number' &&
        typeof (value as OKLCH).c === 'number' &&
        typeof (value as OKLCH).h === 'number'
    );
}

/**
 * Resolve a CSS `var(--NAME)` string to the referenced token name.
 *
 * @param value - Candidate string.
 * @returns Token name (without leading `--`) or `null` if not a plain var ref.
 */
function parseVarRef(value: string): string | null {
    const m = /^var\(--([a-z][a-z0-9-]*)\)$/.exec(value);
    return m?.[1] ?? null;
}

/**
 * Attempt to resolve a `palette-<name>-<shade>` CSS token name to its OKLCH
 * value directly from the `palettes` registry. Domain tokens reference palette
 * primitives via var(); this is the second-level fallback when the named
 * token is not in the theme record.
 *
 * @param tokenName - CSS token name fragment (e.g. `'palette-accent-500'`).
 * @returns The OKLCH value if found, or `null` otherwise.
 */
function lookupPaletteToken(tokenName: string): OKLCH | null {
    // Pattern: palette-<paletteName>-<shade>
    const m = /^palette-([a-z][a-z0-9-]*)-(\d+)$/.exec(tokenName);
    if (m === null || m[1] === undefined || m[2] === undefined) return null;

    const paletteName = m[1];
    const shade = Number(m[2]) as Shade;

    // Validate shade is one of the valid SHADES values.
    if (!(SHADES as ReadonlyArray<number>).includes(shade)) return null;

    // Look up the palette by name.
    const palette = (palettes as Record<string, Record<Shade, OKLCH>>)[paletteName];
    if (palette === undefined) return null;

    const value = palette[shade];
    return isOklch(value) ? value : null;
}

// ============================================================================
// Public resolver
// ============================================================================

/**
 * Resolve a variant-token base name to its OKLCH triple.
 *
 * Handles three resolution paths (in order):
 * 1. The CSS-wide `'white'` keyword → fixed `{ l: 1, c: 0, h: 0 }`.
 * 2. Direct theme lookup → if `theme[base]` is OKLCH, return it.
 * 3. One-level var() indirection → if `theme[base]` is `'var(--NAME)'`:
 *    a. If `theme[NAME]` is OKLCH, return it.
 *    b. If `NAME` matches `palette-<name>-<shade>`, look it up in `palettes`.
 *
 * @param base - Base token name (without `--`), or the `'white'` keyword.
 * @param theme - Theme record to look up base values in. Defaults to
 *   `webLight` (the standard production lookup).
 * @returns The resolved OKLCH triple.
 * @throws {Error} If the base cannot be resolved through any strategy.
 *
 * @example
 * ```ts
 * // Direct OKLCH token:
 * resolveBaseToOklch('brand-primary')
 * // => { l: 0.63, c: 0.19, h: 259 }
 *
 * // One-level var() + theme:
 * resolveBaseToOklch('footer-fg')
 * // => OKLCH of surface-dark-foreground
 *
 * // Two-level var() + palette (new in T-006):
 * resolveBaseToOklch('accommodation-type-hotel')
 * // => OKLCH of palettes['accent'][500]  (via var(--palette-accent-500))
 *
 * // White keyword:
 * resolveBaseToOklch('white')
 * // => { l: 1, c: 0, h: 0 }
 * ```
 */
export function resolveBaseToOklch(base: string, theme: Theme = webLight): OKLCH {
    // 1. White keyword special case.
    if (base === 'white') return WHITE_OKLCH;

    const rawValue = theme[base];

    if (rawValue === undefined) {
        throw new Error(
            `[resolve-base-oklch] Cannot resolve base token '${base}': not found in theme. All variant token bases must map to an OKLCH-typed entry or a var() reference to one.`
        );
    }

    // 2. Direct OKLCH object.
    if (isOklch(rawValue)) {
        return rawValue;
    }

    // 3. CSS var() reference — resolve transitively (one level).
    if (typeof rawValue === 'string') {
        const refName = parseVarRef(rawValue);
        if (refName !== null) {
            // 3a. Ref resolves within the theme itself.
            const refValue = theme[refName];
            if (isOklch(refValue)) {
                return refValue;
            }

            // 3b. Palette lookup — handles domain tokens like
            //     `accommodation-type-hotel` → `var(--palette-accent-500)`.
            const paletteValue = lookupPaletteToken(refName);
            if (paletteValue !== null) {
                return paletteValue;
            }

            throw new Error(
                `[resolve-base-oklch] Base token '${base}' resolves to var(--${refName}), but '${refName}' is neither OKLCH in the theme (value: ${String(refValue)}) nor a resolvable palette token (expected 'palette-<name>-<shade>' form).`
            );
        }

        throw new Error(
            `[resolve-base-oklch] Base token '${base}' has a string value that is not a plain ` +
                `var(--NAME) reference: '${rawValue}'. Cannot resolve to OKLCH for sRGB fallback.`
        );
    }

    throw new Error(
        `[resolve-base-oklch] Base token '${base}' has an unexpected value type ` +
            `(type: ${typeof rawValue}). Expected an OKLCH object or a var(--NAME) string.`
    );
}
