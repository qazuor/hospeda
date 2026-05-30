/**
 * @file variant-tokens.ts
 * @description SPEC-176 — Variant token map scaffold.
 *
 * Defines the `VariantTokenSpec` type and the `VARIANT_TOKEN_MAP` constant.
 * In T-001 (regression guard setup) this map is intentionally empty — the
 * three coverage tests in `variant-token-coverage.test.ts` iterate it and
 * pass trivially while it holds no entries.
 *
 * T-002 installs `culori` and implements `formatSRGB()`.
 * T-003 populates VARIANT_TOKEN_MAP with all 42 derived entries.
 * T-004 extends `generate-css.ts` to emit the dual-declaration blocks.
 *
 * SPEC-176: populate VARIANT_TOKEN_MAP in T-002/T-003 to make this guard
 * meaningful (RED→GREEN).
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Describes the transform kind applied to a base token to produce a variant.
 *
 * - `'alpha'` — multiplies the channel's alpha component: `oklch(from var(--base) l c h / ALPHA)`.
 * - `'lightness-mul'` — scales lightness: `oklch(from var(--base) calc(l * FACTOR) c h)`.
 * - `'lightness-sub'` — subtracts from lightness: `oklch(from var(--base) calc(l - OFFSET) c h)`.
 */
export type VariantTransformKind = 'alpha' | 'lightness-mul' | 'lightness-sub';

/**
 * A single entry in the VARIANT_TOKEN_MAP.
 *
 * Each entry records:
 * - The CSS custom property name for the variant (without leading `--`).
 * - The base token CSS name (without leading `--`).
 * - The transform family and its numeric parameter.
 * - The exact `oklch(from ...)` string the codemod must replace across web source.
 *
 * Naming convention (D6 — locked):
 * - Alpha: `{base}-a{NN}` where NN = `Math.round(alpha * 100).toString().padStart(2, '0')`.
 *   Example: base `brand-primary`, alpha 0.15 → `brand-primary-a15`.
 * - Lightness multiply: `{base}-l{NN}` where NN = `Math.round(factor * 100)`.
 *   Example: base `brand-primary`, factor 0.85 → `brand-primary-l85`.
 * - Lightness subtract: `{base}-lm{NN}` where NN = `Math.round(offset * 100)`.
 *   Example: base `core-background`, offset 0.20 → `core-background-lm20`.
 * - Combined: `{base}-l{NN}-a{NN}` when both transforms apply.
 *
 * @example
 * ```ts
 * const entry: VariantTokenSpec = {
 *   name: 'brand-primary-a15',
 *   base: 'brand-primary',
 *   kind: 'alpha',
 *   amount: 0.15,
 *   replaces: 'oklch(from var(--brand-primary) l c h / 0.15)',
 * };
 * ```
 */
export interface VariantTokenSpec {
    /** CSS custom property name (without leading `--`). Must match D6 naming convention. */
    readonly name: string;
    /** Base token CSS name (without leading `--`). Must map to an OKLCH entry in webLight theme. */
    readonly base: string;
    /** Transform kind applied to the base token. */
    readonly kind: VariantTransformKind;
    /**
     * Numeric parameter for the transform.
     * - alpha: 0 < amount ≤ 1 (the alpha fraction, e.g. 0.15).
     * - lightness-mul: 0 < amount ≤ 2 (the scale factor, e.g. 0.85).
     * - lightness-sub: 0 < amount < 1 (the subtracted offset, e.g. 0.20).
     */
    readonly amount: number;
    /**
     * The exact `oklch(from var(--{base}) ...)` string that the codemod
     * (`codemod-relative-colors.mjs`, T-005) replaces with `var(--{name})`.
     * Must be byte-for-byte identical to how the pattern appears in web source.
     */
    readonly replaces: string;
}

// ============================================================================
// VARIANT_TOKEN_MAP
// ============================================================================

/**
 * Ordered list of all variant tokens that need sRGB fallbacks.
 *
 * In T-001 this array is empty — the coverage tests iterate it and pass
 * trivially. T-003 populates it with all 42 entries derived from the SPEC-176
 * oklch census of `apps/web/src/`.
 *
 * The `replaces` field is what the T-005 codemod searches for and replaces
 * with `var(--{name})`. Keep each entry's `replaces` string byte-for-byte
 * identical to the actual usage in web source files.
 *
 * @see T-003 for derivation methodology (census script + naming convention D6).
 * @see T-004 for the generator that emits dual-declaration CSS blocks.
 * @see T-005 for the codemod that replaces 679 call-sites.
 *
 * SPEC-176: populate this map in T-002/T-003 to make the regression guard
 * meaningful (RED→GREEN).
 */
export const VARIANT_TOKEN_MAP: ReadonlyArray<VariantTokenSpec> = [
    // T-003: 42 entries (alpha family + lightness families) go here.
];
