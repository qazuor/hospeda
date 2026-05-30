/**
 * @file variant-token-coverage.test.ts
 * @description SPEC-176 T-001 + T-002 — Regression guard for variant token CSS coverage
 * and formatSRGB() unit tests.
 *
 * Guards that:
 * 1. Every variant token in VARIANT_TOKEN_MAP has a sRGB fallback declaration
 *    in `:root` OUTSIDE any `@supports` block.
 * 2. Every variant token has an oklch declaration inside the
 *    `@supports (color: oklch(from white l c h))` block.
 * 3. No variant token name collides with existing palette or theme token names.
 *
 * In T-001 VARIANT_TOKEN_MAP is intentionally empty, so all three `it` blocks
 * iterate an empty array and pass trivially. This is by design: the guard
 * structure is proven before the fix lands.
 *
 * T-002 adds the `formatSRGB` describe block below with 3 unit tests:
 * - Output shape matches CSS rgb() space-separated integer syntax.
 * - A known in-gamut achromatic value converts to the correct gray.
 * - A high-chroma out-of-gamut value produces no negative or overflow channels.
 *
 * SPEC-176: populate VARIANT_TOKEN_MAP in T-002/T-003 to make this guard
 * meaningful (RED→GREEN). Once T-004 runs `emitVariantTokens()`, the three
 * assertions will enforce the dual-declaration pattern for all 42 entries.
 */

import { describe, expect, it } from 'vitest';

import { buildCSS } from './generate-css.ts';
import { formatSRGB } from './srgb.ts';
import { VARIANT_TOKEN_MAP } from './variant-tokens.ts';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract the content of the `@supports (color: oklch(from white l c h))` block
 * from a CSS string. Returns an empty string if the block is absent.
 *
 * @param css - Full CSS string to search.
 * @returns Content inside the @supports block, or empty string if not found.
 */
function extractSupportsBlock(css: string): string {
    const PROBE = '@supports (color: oklch(from white l c h))';
    const start = css.indexOf(PROBE);
    if (start === -1) return '';
    // Find the opening brace of the @supports block.
    const braceOpen = css.indexOf('{', start);
    if (braceOpen === -1) return '';
    // Walk forward to find the matching closing brace (naive: one level of nesting).
    let depth = 0;
    let i = braceOpen;
    while (i < css.length) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') {
            depth--;
            if (depth === 0) return css.slice(braceOpen + 1, i);
        }
        i++;
    }
    return '';
}

/**
 * Strip the content of every `@supports` block from a CSS string to isolate
 * the unconditional `:root` declarations.
 *
 * @param css - Full CSS string.
 * @returns CSS string with `@supports` blocks replaced by empty space.
 */
function stripSupportBlocks(css: string): string {
    // Replace each @supports { ... } block with whitespace so character offsets
    // remain stable and the regex `/--name: rgb\(/` finds only :root declarations.
    return css.replace(/@supports[^{]*\{(?:[^{}]*|\{[^{}]*\})*\}/g, (match) =>
        ' '.repeat(match.length)
    );
}

/**
 * Collect every `--token-name` declared anywhere in the CSS string.
 * Used to detect collisions between variant names and existing tokens.
 *
 * @param css - Full CSS string to scan.
 * @returns Set of token names (without leading `--`).
 */
function collectAllTokenNames(css: string): Set<string> {
    const names = new Set<string>();
    const re = /--([a-zA-Z0-9_-]+)\s*:/g;
    let m = re.exec(css);
    while (m !== null) {
        if (m[1]) names.add(m[1]);
        m = re.exec(css);
    }
    return names;
}

// ============================================================================
// Pre-compute CSS once for all tests (pure function — no filesystem IO).
// ============================================================================

const CSS = buildCSS();
const cssWithoutSupports = stripSupportBlocks(CSS);
const supportsBlock = extractSupportsBlock(CSS);

// ============================================================================
// Tests
// ============================================================================

describe('variant-token-coverage (SPEC-176 T-001 guard)', () => {
    /**
     * Guard 1 — every variant token must have a sRGB :root declaration.
     *
     * Pattern: `--{name}: rgb(` OUTSIDE any @supports block.
     * While VARIANT_TOKEN_MAP is empty this passes trivially.
     * After T-004 lands, each of the 42 entries must satisfy this.
     */
    it('every variant token has a non-oklch sRGB :root declaration', () => {
        // SPEC-176: populate VARIANT_TOKEN_MAP in T-002/T-003 to make this guard
        // meaningful (RED→GREEN).
        for (const entry of VARIANT_TOKEN_MAP) {
            const pattern = `--${entry.name}: rgb(`;
            expect(
                cssWithoutSupports,
                `Expected --${entry.name} to have a sRGB rgb() fallback in :root (outside @supports)`
            ).toContain(pattern);
        }
        // Invariant: if the map is empty the test passes (T-001 intent).
        expect(VARIANT_TOKEN_MAP.length).toBeGreaterThanOrEqual(0);
    });

    /**
     * Guard 2 — every variant token must have an oklch declaration inside @supports.
     *
     * Pattern: `--{name}:` containing `oklch(from var(` INSIDE the
     * `@supports (color: oklch(from white l c h))` block.
     * While VARIANT_TOKEN_MAP is empty this passes trivially.
     * After T-004 lands, each of the 42 entries must satisfy this.
     */
    it('every variant token has an oklch declaration inside @supports', () => {
        // SPEC-176: populate VARIANT_TOKEN_MAP in T-002/T-003 to make this guard
        // meaningful (RED→GREEN).
        for (const entry of VARIANT_TOKEN_MAP) {
            // The @supports block must exist before we can assert inside it.
            expect(
                supportsBlock,
                'Expected @supports (color: oklch(from white l c h)) block to be present in CSS'
            ).not.toBe('');

            const namePattern = `--${entry.name}:`;
            expect(
                supportsBlock,
                `Expected --${entry.name} to be declared inside the @supports oklch block`
            ).toContain(namePattern);

            expect(
                supportsBlock,
                `Expected --${entry.name} inside @supports to use oklch(from var(`
            ).toContain('oklch(from var(');
        }
        // Invariant: if the map is empty the test passes (T-001 intent).
        expect(VARIANT_TOKEN_MAP.length).toBeGreaterThanOrEqual(0);
    });

    /**
     * Guard 3 — variant token names must not collide with existing tokens.
     *
     * Collect every `--token:` declaration in the full CSS and assert that
     * no variant name appears among the non-variant token set. This prevents
     * the variant generator from shadowing palette or theme tokens.
     * While VARIANT_TOKEN_MAP is empty this passes trivially.
     * After T-003 defines names and T-004 emits CSS, this catches conflicts.
     */
    it('no variant token name collides with existing palette or theme token names', () => {
        // SPEC-176: populate VARIANT_TOKEN_MAP in T-002/T-003 to make this guard
        // meaningful (RED→GREEN).
        if (VARIANT_TOKEN_MAP.length === 0) {
            // Nothing to check — trivially passes.
            expect(VARIANT_TOKEN_MAP.length).toBe(0);
            return;
        }

        // Build the set of variant names first.
        const variantNames = new Set(VARIANT_TOKEN_MAP.map((e) => e.name));

        // Collect every declared token in the CSS (includes palette + theme tokens).
        const allDeclared = collectAllTokenNames(CSS);

        // Remove the variant names themselves from the declared set so we only
        // compare against pre-existing (non-variant) tokens.
        const nonVariantDeclared = new Set([...allDeclared].filter((n) => !variantNames.has(n)));

        for (const entry of VARIANT_TOKEN_MAP) {
            expect(
                nonVariantDeclared.has(entry.name),
                `Variant token --${entry.name} collides with an existing palette or theme token`
            ).toBe(false);
        }
    });
});

// ============================================================================
// T-002 — formatSRGB() unit tests
// ============================================================================

describe('formatSRGB (SPEC-176 T-002 — OKLCH→sRGB converter)', () => {
    /**
     * Case 1 — Output shape: the returned string must match the CSS rgb()
     * space-separated integer syntax `/^rgb\(\d+ \d+ \d+\)$/`.
     *
     * Uses the brand-primary river blue (0.63 0.19 259) as a representative
     * in-gamut value. The regex guards that:
     * - No commas (legacy format) are present.
     * - Exactly three space-separated integer components appear.
     * - The function returns a complete, parseable CSS value.
     */
    it('output matches CSS rgb() space-separated integer syntax', () => {
        const result = formatSRGB({ l: 0.63, c: 0.19, h: 259 });
        expect(result).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
    });

    /**
     * Case 2 — In-gamut achromatic sanity: an achromatic OKLCH value
     * (c=0, any hue) must convert to a neutral gray with equal R, G, B
     * channels and a reasonable mid-range value.
     *
     * OKLCH l=0.6 with c=0 maps to rgb(128 128 128) in perceptual lightness
     * (confirmed: culori converter('rgb') at l=0.6 yields r≈g≈b≈0.502).
     * This verifies that the gamut mapping pipeline passes achromatic values
     * through unchanged and that channel math (×255 + round) is correct.
     */
    it('achromatic mid-gray produces equal r/g/b channels around 128', () => {
        const result = formatSRGB({ l: 0.6, c: 0.0, h: 0 });
        // Must be rgb(128 128 128) — OKLCH l=0.6, c=0 is precisely mid-gray.
        expect(result).toBe('rgb(128 128 128)');
    });

    /**
     * Case 3 — Out-of-gamut high-chroma: a supersaturated color that exceeds
     * the sRGB gamut boundaries must produce NO negative channels and NO
     * overflow channels (all R, G, B must be in [0, 255]).
     *
     * Uses l=0.7, c=0.4, h=140 — a vivid yellow-green that is significantly
     * outside sRGB. culori's clampChroma reduces chroma until the color fits,
     * yielding sRGB-safe integer values. The Math.max/Math.min clamp in the
     * implementation provides an additional floating-point noise guard.
     */
    it('out-of-gamut high-chroma value produces no negative or overflow channels', () => {
        const result = formatSRGB({ l: 0.7, c: 0.4, h: 140 });
        // Must still match the shape guard.
        expect(result).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
        // Extract and validate each channel.
        const inner = result.slice(4, -1); // strip 'rgb(' and ')'
        const channels = inner.split(' ').map(Number);
        expect(channels).toHaveLength(3);
        for (const ch of channels) {
            expect(ch, `Channel value ${ch} must be >= 0`).toBeGreaterThanOrEqual(0);
            expect(ch, `Channel value ${ch} must be <= 255`).toBeLessThanOrEqual(255);
        }
    });
});
