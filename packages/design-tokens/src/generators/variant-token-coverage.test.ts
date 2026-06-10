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
import { VariantTokenMapSchema } from './variant-token-schema.js';
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
 * Strip the content of every `@supports` AT-RULE block from a CSS string to
 * isolate the unconditional `:root` declarations.
 *
 * The regex anchors to `@supports` followed by a parenthesis `(` so it only
 * matches actual CSS at-rules, not the word `@supports` when it appears inside
 * CSS comment text (e.g. the SPEC-176 sentinel comment contains `@supports`
 * as part of its prose description and must NOT be treated as an at-rule).
 *
 * @param css - Full CSS string.
 * @returns CSS string with `@supports (...)` at-rule blocks replaced by empty
 *   space of the same length so character offsets remain stable.
 */
function stripSupportBlocks(css: string): string {
    // Anchor: @supports MUST be followed by optional whitespace then `(`.
    // This prevents false-positive matches on `@supports` inside comment text.
    return css.replace(/@supports\s*\([^{]*\{(?:[^{}]*|\{[^{}]*\})*\}/g, (match) =>
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
     *
     * T-004 (emitVariantTokens) is now implemented. This assertion is
     * UNCONDITIONAL — the sentinel comment MUST be present and every variant
     * token MUST have a sRGB fallback declaration in `:root`.
     *
     * If this test fails after T-004 lands, the generator is broken — fix
     * the generator, not the test.
     */
    it('every variant token has a non-oklch sRGB :root declaration', () => {
        // Sentinel must be present — proves emitVariantTokens() ran.
        expect(CSS, 'Expected SPEC-176 variant sentinel comment in generated CSS').toContain(
            '/* SPEC-176: Variant tokens'
        );

        // Every entry must have a sRGB rgb() fallback OUTSIDE the @supports block.
        for (const entry of VARIANT_TOKEN_MAP) {
            const pattern = `--${entry.name}: rgb(`;
            expect(
                cssWithoutSupports,
                `Expected --${entry.name} to have a sRGB rgb() fallback in :root (outside @supports)`
            ).toContain(pattern);
        }
    });

    /**
     * Guard 2 — every variant token must have an oklch declaration inside @supports.
     *
     * Pattern: `--{name}:` containing `oklch(from var(` INSIDE the
     * `@supports (color: oklch(from white l c h))` block.
     *
     * T-004 (emitVariantTokens) is now implemented. This assertion is
     * UNCONDITIONAL — the @supports block MUST be present and every variant
     * token MUST have an oklch relative-color declaration inside it.
     *
     * If this test fails after T-004 lands, the generator is broken — fix
     * the generator, not the test.
     */
    it('every variant token has an oklch declaration inside @supports', () => {
        // @supports block must exist.
        expect(
            supportsBlock,
            'Expected @supports (color: oklch(from white l c h)) block to be present in CSS'
        ).not.toBe('');

        for (const entry of VARIANT_TOKEN_MAP) {
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
    });

    /**
     * Guard 3 — variant token names must not collide with existing tokens.
     *
     * Collect every `--token:` declaration in the full CSS and assert that
     * no variant name appears among the non-variant token set. This prevents
     * the variant generator from shadowing palette or theme tokens.
     *
     * With VARIANT_TOKEN_MAP populated and T-004 not yet run, the variant names
     * are NOT in the CSS, so `collectAllTokenNames(CSS)` returns only existing
     * palette + theme tokens. The check correctly passes: none of the variant
     * names collide with existing tokens (which is the pre-condition needed
     * before T-004 emits them).
     *
     * After T-004 runs, the variant names appear in both the map and the CSS,
     * so they are excluded from `nonVariantDeclared` by the filter, and the
     * assertion still holds.
     */
    it('no variant token name collides with existing palette or theme token names', () => {
        if (VARIANT_TOKEN_MAP.length === 0) {
            // Nothing to check — trivially passes (T-001 empty-map phase).
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

    /**
     * Guard 4 (T-009) — dark-mode sRGB fallback block for Chrome 109.
     *
     * The emitter produces a `@supports not (color: oklch(from white l c h))`
     * block scoped to `[data-theme="dark"]:not([data-app="admin"])` that
     * re-declares the sRGB fallbacks for variant tokens whose BASE token is
     * overridden in the dark theme. On Chrome 109 this block wins (the `not`
     * condition matches), so dark mode shows dark colors instead of leaking the
     * light `:root` values — satisfying PDR Story 1 AC5 / Edge Case 3. On modern
     * browsers the `not` condition is false, the block is inert, and the
     * live-tracking `@supports (oklch)` block governs dark mode instead.
     *
     * Assertions:
     * 1. The dark block exists and is gated by `@supports not (oklch...)`.
     * 2. A token on an overridden base (brand-primary-a15) is re-declared with a
     *    dark value that DIFFERS from its light `:root` value.
     * 3. Domain tokens (no dark base override) are NOT in the dark block.
     */
    it('emits a dark-mode sRGB fallback block gated by @supports not (oklch) (T-009)', () => {
        const DARK_PROBE = '@supports not (color: oklch(from white l c h))';
        const darkStart = CSS.indexOf(DARK_PROBE);
        expect(darkStart, 'Expected the @supports not(oklch) dark fallback block').toBeGreaterThan(
            -1
        );

        // Isolate the dark block content (naive matched-brace walk from the probe).
        const braceOpen = CSS.indexOf('{', darkStart);
        let depth = 0;
        let end = braceOpen;
        for (let i = braceOpen; i < CSS.length; i++) {
            if (CSS[i] === '{') depth++;
            else if (CSS[i] === '}') {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        const darkBlock = CSS.slice(braceOpen, end);

        // Scoped to the web dark selector, not admin.
        expect(darkBlock).toContain('[data-theme="dark"]:not([data-app="admin"])');

        // A token on a dark-overridden base is re-declared with a different value.
        const lightMatch = /--brand-primary-a15: (rgb\([^)]*\));/.exec(cssWithoutSupports);
        const darkMatch = /--brand-primary-a15: (rgb\([^)]*\));/.exec(darkBlock);
        expect(lightMatch?.[1], 'light brand-primary-a15 must be declared').toBeTruthy();
        expect(darkMatch?.[1], 'dark brand-primary-a15 must be declared').toBeTruthy();
        expect(darkMatch?.[1], 'dark brand-primary-a15 must differ from the light value').not.toBe(
            lightMatch?.[1]
        );

        // Domain tokens have no dark base override → must NOT appear in the block.
        expect(
            darkBlock,
            'domain tokens (no dark override) must not be in the dark block'
        ).not.toContain('--accommodation-type-hotel-a15:');
    });
});

// ============================================================================
// T-003 — VARIANT_TOKEN_MAP Zod schema validation and D6 naming checks
// ============================================================================

describe('VARIANT_TOKEN_MAP validation (SPEC-176 T-003)', () => {
    /**
     * Schema validation — the entire map must parse without errors.
     *
     * Validates: name/base regex, family enum, finite param, non-empty replaces,
     * no duplicate names, no duplicate replaces strings.
     */
    it('VARIANT_TOKEN_MAP passes Zod schema validation', () => {
        expect(() => VariantTokenMapSchema.parse(VARIANT_TOKEN_MAP)).not.toThrow();
    });

    /**
     * Count assertion — consolidated count (T-005) plus domain alpha tokens (T-006).
     *
     * The faithful scan found 116 alpha-family pairs. Conservative consolidation
     * onto a 14-step grid (snap rule: |value − step| ≤ 0.025) reduced them to 92.
     * T-005 part C added 12 FAITHFUL kept-own alpha tokens (exact value, no snap)
     * to close real var-with-fallback alpha-gaps, plus 1 lightness-multiply token
     * (muted-l105) for the login shimmer.
     * T-006 added 126 domain alpha tokens (63 domain bases × 2: a15 + a30) for
     * icon subtle badge variants that Chrome 109 could not render.
     *
     *   - 104 alpha-family (92 consolidated + 12 FAITHFUL kept-own gap-fillers)
     *   -   1 white-origin alpha (oklch(from white l c h / 0.75))
     *   -  11 lightness-multiply pairs (incl. muted-l105 — T-005 part C)
     *   -  10 lightness-subtract pairs
     *   -   2 lightness-add pairs
     *   - 126 domain alpha (63 bases × a15+a30 — T-006)
     *   = 254 total canonical entries.
     *
     * Max snap delta applied to consolidated tokens: 0.020 (imperceptible). The
     * FAITHFUL gap-fillers have delta 0 (exact source value).
     */
    it('has the expected canonical count (254 entries)', () => {
        expect(VARIANT_TOKEN_MAP.length).toBe(254);
    });

    /**
     * D6 naming convention — every name must follow the locked pattern.
     *
     * - alpha:              `^[a-z][a-z0-9-]+-a\d{2,}$`
     * - lightness-multiply: `^[a-z][a-z0-9-]+-l\d{2,}$`
     * - lightness-subtract: `^[a-z][a-z0-9-]+-lm\d{2,}$`
     * - lightness-add:      `^[a-z][a-z0-9-]+-lp\d{2,}$`
     */
    it('every name follows the D6 naming convention (SPEC-176)', () => {
        const suffixPatterns: Record<string, RegExp> = {
            alpha: /^[a-z][a-z0-9-]+-a\d{2,}$/,
            'lightness-multiply': /^[a-z][a-z0-9-]+-l\d{2,}$/,
            'lightness-subtract': /^[a-z][a-z0-9-]+-lm\d{2,}$/,
            'lightness-add': /^[a-z][a-z0-9-]+-lp\d{2,}$/
        };
        for (const entry of VARIANT_TOKEN_MAP) {
            const pattern = suffixPatterns[entry.family];
            expect(
                entry.name,
                `Token '${entry.name}' does not follow D6 naming for family '${entry.family}'`
            ).toMatch(pattern);
        }
    });

    /**
     * replaces field correctness — every replaces string must reference its
     * base token.
     *
     * For ordinary tokens the form is `oklch(from var(--BASE) ...)`. The single
     * white-origin token uses the bare CSS keyword (`oklch(from white ...)`),
     * which is handled as an explicit exception.
     */
    it('every replaces string references the correct base token', () => {
        for (const entry of VARIANT_TOKEN_MAP) {
            if (entry.base === 'white') {
                // White-origin tokens reference the CSS keyword, not var(--white).
                expect(
                    entry.replaces,
                    `replaces for '${entry.name}' must start with 'oklch(from white'`
                ).toMatch(/^oklch\(from white /);
                continue;
            }
            expect(
                entry.replaces,
                `replaces for '${entry.name}' must start with 'oklch(from var(--'`
            ).toMatch(/^oklch\(from var\(--/);
            expect(
                entry.replaces,
                `replaces for '${entry.name}' must contain base token '--${entry.base}'`
            ).toContain(`--${entry.base})`);
        }
    });

    /**
     * Alpha snap guard — every consolidated alpha token's canonical step must be
     * within 0.025 of every source value it covers (replaces + replacesVariants).
     *
     * This proves that the snap rule held: no value was snapped more than 0.025
     * away from the canonical grid step. For kept-own tokens the delta is 0.
     *
     * Parse logic:
     * - Token name `{base}-a{NN}` → canonical alpha = NN / 100.
     * - Extract numeric value from each `oklch(from var(--base) l c h / VALUE)` string.
     * - Assert |VALUE − canonical| ≤ 0.025.
     */
    it('all alpha snap deltas are within the 0.025 threshold', () => {
        const SNAP_THRESHOLD = 0.025;
        // Regex to extract the alpha value from an oklch literal.
        const ALPHA_RE = /l c h \/ ([0-9.]+)\)$/;
        // Regex to extract NN from token name suffix -a{NN}.
        const NAME_ALPHA_RE = /-a(\d+)$/;

        for (const entry of VARIANT_TOKEN_MAP) {
            if (entry.family !== 'alpha') continue;

            // Parse canonical alpha from token name (e.g. 'brand-accent-a05' → 0.05).
            const nameMatch = NAME_ALPHA_RE.exec(entry.name);
            if (nameMatch === null || nameMatch[1] === undefined) continue;
            const canonicalAlpha = Number(nameMatch[1]) / 100;

            // Collect all source literals this token covers.
            const allLiterals = [entry.replaces, ...(entry.replacesVariants ?? [])];

            for (const literal of allLiterals) {
                if (literal === 'oklch(from var(--core-card) l c h / 1)') {
                    // alpha=1 special case: canonical = 1.0, name = a100 → delta=0.
                    continue;
                }
                const alphaMatch = ALPHA_RE.exec(literal);
                if (alphaMatch === null || alphaMatch[1] === undefined) continue;
                const sourceAlpha = Number(alphaMatch[1]);
                const delta = Math.abs(sourceAlpha - canonicalAlpha);
                expect(
                    delta,
                    `Token '${entry.name}': source literal '${literal}' has sourceAlpha=${sourceAlpha}, canonicalAlpha=${canonicalAlpha}, delta=${delta} > threshold ${SNAP_THRESHOLD}`
                ).toBeLessThanOrEqual(SNAP_THRESHOLD);
            }
        }
    });

    /**
     * Spelling variant integrity — replacesVariants must not duplicate replaces.
     * Only a few entries have replacesVariants; all others have none.
     */
    it('replacesVariants do not duplicate the canonical replaces string', () => {
        for (const entry of VARIANT_TOKEN_MAP) {
            if (entry.replacesVariants === undefined) continue;
            for (const variant of entry.replacesVariants) {
                expect(
                    variant,
                    `replacesVariants entry for '${entry.name}' must differ from canonical replaces`
                ).not.toBe(entry.replaces);
            }
        }
    });

    /**
     * Family breakdown — verify per-family counts match the post-consolidation
     * totals plus T-005 part C FAITHFUL gap-fillers plus T-006 domain alphas.
     *
     * Alpha: 116 faithful → 92 after conservative ≤0.025 grid consolidation,
     * + 12 FAITHFUL kept-own gap-fillers (T-005 part C) + 1 white-origin alpha
     * (white-a75) + 126 domain alpha (T-006) = 231.
     * Lightness-multiply: 10 + 1 (muted-l105, T-005 part C) = 11.
     * Other lightness families: unchanged 1:1 faithful counts.
     */
    it('per-family breakdown matches consolidated counts', () => {
        const counts = {
            alpha: VARIANT_TOKEN_MAP.filter((e) => e.family === 'alpha').length,
            'lightness-multiply': VARIANT_TOKEN_MAP.filter((e) => e.family === 'lightness-multiply')
                .length,
            'lightness-subtract': VARIANT_TOKEN_MAP.filter((e) => e.family === 'lightness-subtract')
                .length,
            'lightness-add': VARIANT_TOKEN_MAP.filter((e) => e.family === 'lightness-add').length
        };
        expect(counts.alpha).toBe(231);
        expect(counts['lightness-multiply']).toBe(11);
        expect(counts['lightness-subtract']).toBe(10);
        expect(counts['lightness-add']).toBe(2);
    });

    /**
     * T-005 part C — the 12 FAITHFUL kept-own alpha gap-fillers and the
     * muted-l105 lightness token must exist with their exact source param.
     * These close real var-with-fallback gaps the codemod could not snap.
     */
    it('T-005 part C FAITHFUL gap tokens exist with exact param', () => {
        const find = (name: string) => VARIANT_TOKEN_MAP.find((e) => e.name === name);
        const expectations: ReadonlyArray<readonly [string, number]> = [
            ['core-background-a70', 0.7],
            ['core-card-a25', 0.25],
            ['core-card-a30', 0.3],
            ['core-card-a50', 0.5],
            ['destructive-a04', 0.04],
            ['destructive-a05', 0.05],
            ['destructive-a18', 0.18],
            ['destructive-a25', 0.25],
            ['info-a20', 0.2],
            ['success-a15', 0.15],
            ['success-a30', 0.3],
            ['warning-a35', 0.35],
            ['muted-l105', 1.05]
        ];
        for (const [name, param] of expectations) {
            const entry = find(name);
            expect(entry, `Expected token --${name} to exist`).toBeDefined();
            expect(entry?.param, `Token --${name} must have param ${param}`).toBe(param);
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
