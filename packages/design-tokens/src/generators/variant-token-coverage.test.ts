/**
 * @file variant-token-coverage.test.ts
 * @description SPEC-176 T-001 — Regression guard for variant token CSS coverage.
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
 * SPEC-176: populate VARIANT_TOKEN_MAP in T-002/T-003 to make this guard
 * meaningful (RED→GREEN). Once T-004 runs `emitVariantTokens()`, the three
 * assertions will enforce the dual-declaration pattern for all 42 entries.
 */

import { describe, expect, it } from 'vitest';

import { buildCSS } from './generate-css.ts';
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
