/**
 * @file generators/emit-variant-tokens.ts
 * @description SPEC-176 T-004 — CSS emitter for the 115 variant tokens.
 *
 * Produces two CSS blocks:
 *
 * 1. A `:root { }` block with sRGB fallback declarations for all 115 variant
 *    tokens. Preceded by the exact sentinel comment required by the
 *    variant-token-coverage test:
 *
 *    `/* SPEC-176: Variant tokens — sRGB fallback + @supports oklch override. *​/`
 *
 * 2. A `@supports (color: oklch(from white l c h)) { :root { } }` block
 *    containing the 115 oklch relative-color overrides. On modern browsers
 *    (Chrome 111+, Firefox 128+, Safari 16.4+) the @supports block wins and
 *    the variant tokens track the live base-token value. On older browsers the
 *    :root sRGB fallback is used instead.
 *
 * ## Base OKLCH resolution strategy
 *
 * Almost all variant token `base` fields reference a theme token in `webLight`.
 * Most are OKLCH-typed objects. Exceptions:
 *
 * - `footer-fg` → webLight value is `'var(--surface-dark-foreground)'` (a CSS
 *   var reference). Resolution: look up `surface-dark-foreground` in webLight,
 *   which IS OKLCH (`{ l: 0.92, c: 0.01, h: 210 }`).
 * - `ring` → webLight value is `river[500]` (OKLCH), no indirection needed.
 * - `white` → the CSS-wide `white` keyword, NOT a webLight token. Special-cased
 *   to the fixed achromatic triple `{ l: 1, c: 0, h: 0 }`. Its @supports
 *   override emits the bare keyword (`oklch(from white l c h / 0.75)`), not
 *   `var(--white)`.
 *
 * Any unresolvable base throws immediately so the build fails loudly rather
 * than emitting `rgb(NaN NaN NaN)` or `rgb(undefined)` into the CSS.
 *
 * ## Dark-mode on Chrome 109 (T-009 — dark sRGB fallback block)
 *
 * The `:root` sRGB fallbacks are computed from LIGHT-theme base values. On
 * Chrome 109 (pre-@supports), a `[data-theme='dark']` override of the BASE
 * token does NOT retroactively recompute the static `:root` VARIANT value, so
 * the light sRGB would leak into dark mode. To satisfy PDR Story 1 AC5 and
 * Edge Case 3, this emitter also produces a dark fallback block:
 *
 *   `@supports not (color: oklch(from white l c h)) {
 *        [data-theme="dark"]:not([data-app="admin"]) { ...dark sRGB... } }`
 *
 * - On Chrome 109: `@supports not(...)` matches, so the dark sRGB overrides
 *   win (the dark selector out-specifies `:root`). Dark mode shows dark colors.
 * - On modern browsers: `@supports not(...)` does NOT match, so the dark sRGB
 *   block is inert and the `@supports (oklch) :root { oklch(from var(--base)) }`
 *   block wins, tracking the live dark base value. Zero modern regression.
 *
 * Only tokens whose dark sRGB DIFFERS from light are emitted (bases overridden
 * in webDark — ~17 non-domain bases; the 63 domain bases have no dark override
 * and are skipped). Dark fallbacks are computed against the effective dark
 * theme `{ ...webLight, ...webDark }`.
 *
 * @see variant-tokens.ts for VARIANT_TOKEN_MAP.
 * @see srgb.ts for formatSRGB() — the OKLCH→sRGB converter.
 * @see generate-css.ts — integrates this module into buildCSS().
 */

import type { Theme } from '../themes/types.js';
import { webDark } from '../themes/web-dark.js';
import { webLight } from '../themes/web-light.js';
import type { OKLCH } from '../tokens/colors.js';
import { resolveBaseToOklch } from './resolve-base-oklch.js';
import { formatSRGB } from './srgb.js';
import type { VariantTokenEntry } from './variant-token-schema.js';
import { VARIANT_TOKEN_MAP } from './variant-tokens.js';

const INDENT = '    ';
const NL = '\n';

// ============================================================================
// Sentinel comment — MUST match the prefix the coverage test keys on.
// ============================================================================

/**
 * Sentinel comment that triggers the coverage test assertions in
 * `variant-token-coverage.test.ts`. The test checks for the exact prefix
 * `/* SPEC-176: Variant tokens` so this string must not be modified.
 */
const VARIANT_SENTINEL =
    '/* SPEC-176: Variant tokens — sRGB fallback + @supports oklch override. */';

/**
 * Build a lookup record of base OKLCH values for every `base` field that
 * appears in `VARIANT_TOKEN_MAP`.
 *
 * Delegates resolution to {@link resolveBaseToOklch} from `resolve-base-oklch.ts`,
 * which handles:
 * 1. The CSS-wide `white` keyword (fixed achromatic triple).
 * 2. Direct OKLCH entries in `theme`.
 * 3. One-level `var(--NAME)` indirection where `NAME` is OKLCH in `theme`.
 * 4. Two-level `var(--palette-X-NNN)` indirection for domain tokens (T-006).
 *
 * Only the bases that actually appear in the map are resolved — the lookup
 * is built once to keep call cost minimal.
 *
 * @param map - The variant token entries to resolve bases for.
 * @param theme - The theme to look up base values in (defaults to webLight).
 * @returns Record mapping each unique base name to its OKLCH triple.
 * @throws {Error} If any base is not resolvable to an OKLCH value.
 */
function buildBaseOklchLookup(
    map: ReadonlyArray<VariantTokenEntry>,
    theme: Theme = webLight
): Readonly<Record<string, OKLCH>> {
    const lookup: Record<string, OKLCH> = {};
    const uniqueBases = [...new Set(map.map((e) => e.base))];

    for (const base of uniqueBases) {
        // resolveBaseToOklch handles: white special case, direct OKLCH, one-level
        // var() to theme OKLCH, and two-level var() to palette OKLCH (domain tokens).
        lookup[base] = resolveBaseToOklch(base, theme);
    }

    return lookup;
}

// ============================================================================
// Per-family CSS value computers
// ============================================================================

/**
 * Compute the sRGB fallback CSS value for an alpha-family entry.
 *
 * SPECIAL CASE — param === 1 (a100): emit NO alpha channel (`rgb(R G B)`).
 * All other alpha values emit `rgb(R G B / ALPHA)` — note the slash is
 * INSIDE the `rgb()` parentheses (CSS Color Level 4 space syntax).
 *
 * @param baseOklch - The OKLCH triple for the base token.
 * @param param - The canonical alpha value (0–1).
 * @returns CSS color value string, e.g. `rgb(56 133 249 / 0.15)`.
 */
function alphaFallback(baseOklch: OKLCH, param: number): string {
    // formatSRGB returns `rgb(R G B)` — we splice the alpha channel
    // INSIDE the closing paren: rgb(R G B) → rgb(R G B / ALPHA).
    const rgb = formatSRGB(baseOklch);
    if (param === 1) {
        // Opaque — no alpha suffix.
        return rgb;
    }
    // Strip the trailing `)` and append ` / ALPHA)`.
    return `${rgb.slice(0, -1)} / ${param})`;
}

/**
 * Render the base reference used inside an `oklch(from ...)` relative-color.
 *
 * For ordinary theme tokens this is `var(--BASE)`. For the CSS-wide `white`
 * keyword it is the bare keyword `white` (matching the original source literal
 * `oklch(from white l c h / 0.75)`), since `--white` is not a declared token.
 *
 * @param base - The base token name (without leading `--`), or `white`.
 * @returns The `from` reference: `var(--BASE)` or `white`.
 */
function oklchBaseRef(base: string): string {
    return base === 'white' ? 'white' : `var(--${base})`;
}

/**
 * Compute the oklch relative-color value for an alpha-family entry.
 *
 * SPECIAL CASE — param === 1: emit `oklch(from <ref> l c h)` without
 * alpha channel (matches the sRGB fallback's opaque treatment).
 *
 * @param base - The base token name (without leading `--`), or `white`.
 * @param param - The canonical alpha value (0–1).
 * @returns CSS oklch() relative-color string.
 */
function alphaOklch(base: string, param: number): string {
    const ref = oklchBaseRef(base);
    if (param === 1) {
        return `oklch(from ${ref} l c h)`;
    }
    return `oklch(from ${ref} l c h / ${param})`;
}

/**
 * Compute the sRGB fallback for a lightness-multiply entry.
 * The lightness is scaled: `l_new = base.l * param`, clamped to [0, 1].
 *
 * @param baseOklch - The base OKLCH triple.
 * @param param - The lightness multiplier (e.g. 0.85, 1.15).
 * @returns CSS `rgb(R G B)` string.
 */
function lightnessMultiplyFallback(baseOklch: OKLCH, param: number): string {
    const modified: OKLCH = {
        l: Math.min(1, Math.max(0, baseOklch.l * param)),
        c: baseOklch.c,
        h: baseOklch.h
    };
    return formatSRGB(modified);
}

/**
 * Compute the sRGB fallback for a lightness-subtract entry.
 * The lightness is reduced: `l_new = max(0, base.l - param)`.
 *
 * @param baseOklch - The base OKLCH triple.
 * @param param - The lightness offset to subtract (e.g. 0.05).
 * @returns CSS `rgb(R G B)` string.
 */
function lightnessSubtractFallback(baseOklch: OKLCH, param: number): string {
    const modified: OKLCH = {
        l: Math.max(0, baseOklch.l - param),
        c: baseOklch.c,
        h: baseOklch.h
    };
    return formatSRGB(modified);
}

/**
 * Compute the sRGB fallback for a lightness-add entry.
 * The lightness is increased: `l_new = min(1, base.l + param)`.
 *
 * @param baseOklch - The base OKLCH triple.
 * @param param - The lightness offset to add (e.g. 0.10).
 * @returns CSS `rgb(R G B)` string.
 */
function lightnessAddFallback(baseOklch: OKLCH, param: number): string {
    const modified: OKLCH = {
        l: Math.min(1, baseOklch.l + param),
        c: baseOklch.c,
        h: baseOklch.h
    };
    return formatSRGB(modified);
}

// ============================================================================
// Per-entry value pair builder
// ============================================================================

/**
 * Compute the (sRGB fallback, oklch override) pair for a single variant token
 * entry.
 *
 * @param entry - The VARIANT_TOKEN_MAP entry.
 * @param baseOklch - The resolved OKLCH triple for `entry.base`.
 * @returns Object with `fallback` (sRGB CSS value) and `oklchValue` (relative-
 *   color CSS value) for this entry.
 */
function computeValuePair(
    entry: VariantTokenEntry,
    baseOklch: OKLCH
): { readonly fallback: string; readonly oklchValue: string } {
    switch (entry.family) {
        case 'alpha':
            return {
                fallback: alphaFallback(baseOklch, entry.param),
                oklchValue: alphaOklch(entry.base, entry.param)
            };

        case 'lightness-multiply':
            return {
                fallback: lightnessMultiplyFallback(baseOklch, entry.param),
                oklchValue: `oklch(from var(--${entry.base}) calc(l * ${entry.param}) c h)`
            };

        case 'lightness-subtract':
            return {
                fallback: lightnessSubtractFallback(baseOklch, entry.param),
                oklchValue: `oklch(from var(--${entry.base}) calc(l - ${entry.param}) c h)`
            };

        case 'lightness-add':
            return {
                fallback: lightnessAddFallback(baseOklch, entry.param),
                oklchValue: `oklch(from var(--${entry.base}) calc(l + ${entry.param}) c h)`
            };
    }
}

// ============================================================================
// Public emitter
// ============================================================================

/**
 * Emit the variant token CSS section: a `:root` sRGB fallback block and a
 * `@supports (color: oklch(from white l c h)) { :root { } }` override block
 * for all 115 entries in `VARIANT_TOKEN_MAP`.
 *
 * The output is a standalone CSS string ready to be appended to the main
 * `:root` token block in `buildCSS()`. It begins with the exact sentinel
 * comment that the coverage test (`variant-token-coverage.test.ts`) keys on:
 *
 * ```
 * /* SPEC-176: Variant tokens — sRGB fallback + @supports oklch override. *\/
 * ```
 *
 * This function is synchronous and has no filesystem side-effects. It is
 * designed to be called inside the synchronous `buildCSS()` in generate-css.ts.
 *
 * @returns Multi-line CSS string containing both the sRGB :root block and the
 *   @supports override block.
 * @throws {Error} If any base token in VARIANT_TOKEN_MAP cannot be resolved to
 *   an OKLCH value from webLight. The error message names the problematic token
 *   so the build fails with a clear diagnostic.
 *
 * @example
 * ```ts
 * // Inside buildCSS():
 * parts.push(emitVariantTokens());
 * ```
 */
export function emitVariantTokens(): string {
    // Build base OKLCH lookup — throws loudly if any base is unresolvable.
    const baseOklch = buildBaseOklchLookup(VARIANT_TOKEN_MAP);

    // Compute value pairs for every entry: light sRGB fallback + oklch override.
    const rows: Array<{
        readonly name: string;
        readonly fallback: string;
        readonly oklchValue: string;
    }> = VARIANT_TOKEN_MAP.map((entry) => {
        const resolved = baseOklch[entry.base];
        if (resolved === undefined) {
            // This path is guarded by buildBaseOklchLookup above but TypeScript
            // needs the narrowing here because the record index is `string`.
            throw new Error(
                `[emit-variant-tokens] Internal: base '${entry.base}' missing from lookup after resolution.`
            );
        }
        const { fallback, oklchValue } = computeValuePair(entry, resolved);
        return { name: entry.name, fallback, oklchValue };
    });

    // ── sRGB :root block ──────────────────────────────────────────────────
    const rootLines: string[] = [];
    rootLines.push(VARIANT_SENTINEL);
    rootLines.push(':root {');
    for (const { name, fallback } of rows) {
        rootLines.push(`${INDENT}--${name}: ${fallback};`);
    }
    rootLines.push('}');

    // ── @supports oklch override block ────────────────────────────────────
    const supportsLines: string[] = [];
    supportsLines.push('@supports (color: oklch(from white l c h)) {');
    supportsLines.push(`${INDENT}:root {`);
    for (const { name, oklchValue } of rows) {
        supportsLines.push(`${INDENT}${INDENT}--${name}: ${oklchValue};`);
    }
    supportsLines.push(`${INDENT}}`);
    supportsLines.push('}');

    return [...rootLines, '', ...supportsLines, ''].join(NL);
}

/**
 * Emit the dark-mode sRGB fallback block for variant tokens (T-009).
 *
 * Produces a `@supports not (color: oklch(from white l c h))` block scoped to
 * `[data-theme="dark"]:not([data-app="admin"])` that re-declares the sRGB
 * fallback for every variant token whose BASE is overridden in the dark theme
 * (so its dark sRGB differs from the light `:root` value). Tokens whose base is
 * NOT dark-overridden (e.g. the 63 domain tokens) are skipped — their light and
 * dark fallbacks are identical.
 *
 * Behavior:
 * - Chrome 109 (no relative-color support): the `not(...)` condition matches, so
 *   this block applies and dark mode shows dark colors instead of the light
 *   `:root` values (fixes PDR Story 1 AC5 / Edge Case 3).
 * - Modern browsers: the `not(...)` condition is false, so this block is inert
 *   and the live-tracking `@supports (oklch) :root { ... }` block governs dark
 *   mode. Zero modern regression.
 *
 * Emitted as a SEPARATE top-level block (placed after the admin-dark theme block
 * in {@link buildCSS}) so it does not shadow the base-token dark override block
 * that shares the same `[data-theme="dark"]:not([data-app="admin"])` selector.
 *
 * @returns CSS string for the dark variant fallback block, or an empty string
 *   when no variant token has a dark-overridden base.
 */
export function emitVariantDarkFallback(): string {
    const lightLookup = buildBaseOklchLookup(VARIANT_TOKEN_MAP);
    const darkTheme: Theme = { ...webLight, ...webDark };
    const darkLookup = buildBaseOklchLookup(VARIANT_TOKEN_MAP, darkTheme);

    const darkDecls: string[] = [];
    for (const entry of VARIANT_TOKEN_MAP) {
        const lightBase = lightLookup[entry.base];
        const darkBase = darkLookup[entry.base];
        if (lightBase === undefined || darkBase === undefined) {
            throw new Error(
                `[emit-variant-tokens] Internal: base '${entry.base}' missing from dark lookup.`
            );
        }
        const light = computeValuePair(entry, lightBase).fallback;
        const dark = computeValuePair(entry, darkBase).fallback;
        if (dark !== light) {
            darkDecls.push(`${INDENT}${INDENT}--${entry.name}: ${dark};`);
        }
    }

    if (darkDecls.length === 0) {
        return '';
    }

    return [
        '/* SPEC-176 T-009: dark-mode sRGB fallbacks — Chrome 109 only (@supports not). */',
        '@supports not (color: oklch(from white l c h)) {',
        `${INDENT}[data-theme="dark"]:not([data-app="admin"]) {`,
        ...darkDecls,
        `${INDENT}}`,
        '}',
        ''
    ].join(NL);
}
