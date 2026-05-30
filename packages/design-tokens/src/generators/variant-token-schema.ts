/**
 * @file generators/variant-token-schema.ts
 * @description SPEC-176 T-003 — Zod schema for the VARIANT_TOKEN_MAP entries.
 *
 * The schema validates that every entry in the map is internally consistent
 * before the generator emits CSS. It is a build-time self-check, not a
 * runtime input validator.
 *
 * Two array-level refinements enforce:
 * 1. No two entries share the same `name` (CSS custom property collision guard).
 * 2. No two entries share the same `replaces` string (codemod ambiguity guard).
 *
 * @see variant-tokens.ts for the actual VARIANT_TOKEN_MAP constant.
 * @see generate-css.ts (T-004) for the CSS emitter that consumes this map.
 * @see scripts/codemod-relative-colors.mjs (T-005) for the codemod that uses
 *   `replaces` and `replacesVariants` as the find-and-replace table.
 */

import { z } from 'zod';

// ============================================================================
// Entry schema
// ============================================================================

/**
 * Regex for valid CSS custom property name fragments (without leading `--`).
 * Accepts lower-case letters, digits, and hyphens; first character must be
 * a lower-case letter (D6 naming convention, SPEC-176).
 */
const CSS_NAME_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Zod schema for the transform family field.
 *
 * - `'alpha'`              — `oklch(from var(--BASE) l c h / ALPHA)`
 * - `'lightness-multiply'` — `oklch(from var(--BASE) calc(l * FACTOR) c h)`
 * - `'lightness-subtract'` — `oklch(from var(--BASE) calc(l - OFFSET) c h)`
 * - `'lightness-add'`      — `oklch(from var(--BASE) calc(l + OFFSET) c h)`
 *   (used in 2 gradient-stop usages in the web source)
 */
export const VariantFamilySchema = z.enum([
    'alpha',
    'lightness-multiply',
    'lightness-subtract',
    'lightness-add'
]);

/**
 * Zod schema for a single VARIANT_TOKEN_MAP entry.
 *
 * Field contracts:
 * - `name`            — CSS custom property name fragment (without `--`). Must
 *                       follow D6 naming: `{base}-a{NN}`, `{base}-l{NN}`,
 *                       `{base}-lm{NN}`, or `{base}-lp{NN}`.
 * - `base`            — Base token name fragment (without `--`). Must map to an
 *                       entry in the webLight theme with an OKLCH value so the
 *                       generator can derive the sRGB fallback at build time.
 * - `family`          — Transform family (see `VariantFamilySchema`).
 * - `param`           — Numeric parameter for the transform (alpha fraction,
 *                       lightness multiplier, or lightness offset).
 * - `replaces`        — The canonical `oklch(from ...)` literal string exactly
 *                       as it appears in the CSS source. The T-005 codemod uses
 *                       this as the primary find-and-replace target.
 * - `replacesVariants` — Optional additional literal spellings for the same
 *                       logical value (e.g. `'0.30'` vs `'0.3'`). All listed
 *                       strings must be replaced by the codemod with the same
 *                       `var(--{name})` reference. Must NOT duplicate `replaces`.
 *
 * @example
 * ```ts
 * const entry: VariantTokenEntry = {
 *   name: 'brand-primary-a15',
 *   base: 'brand-primary',
 *   family: 'alpha',
 *   param: 0.15,
 *   replaces: 'oklch(from var(--brand-primary) l c h / 0.15)',
 * };
 * ```
 */
export const VariantTokenEntrySchema = z.object({
    /** CSS custom property name (without leading `--`). Must match D6 naming convention. */
    name: z.string().regex(CSS_NAME_RE, 'name must match /^[a-z][a-z0-9-]*/'),
    /** Base token CSS name (without leading `--`). Must map to an OKLCH entry in webLight. */
    base: z.string().regex(CSS_NAME_RE, 'base must match /^[a-z][a-z0-9-]*/'),
    /** Transform family applied to the base token. */
    family: VariantFamilySchema,
    /**
     * Numeric parameter for the transform.
     * - alpha: decimal 0–1 (alpha fraction, e.g. 0.15).
     * - lightness-multiply: multiplier (e.g. 0.85, 1.15).
     * - lightness-subtract: offset to subtract from lightness (e.g. 0.05).
     * - lightness-add: offset to add to lightness (e.g. 0.10).
     */
    param: z.number().finite(),
    /**
     * The canonical `oklch(from var(--{base}) ...)` string that the T-005
     * codemod replaces with `var(--{name})`. Must be byte-for-byte identical
     * to how the canonical spelling appears in web CSS source files.
     */
    replaces: z.string().min(1),
    /**
     * Additional literal spellings of the same logical `oklch(from ...)` value
     * that also appear in the CSS source and need the same codemod replacement.
     *
     * Example: `'oklch(from var(--brand-primary) l c h / 0.30)'` is a spelling
     * variant of the canonical `'oklch(from var(--brand-primary) l c h / 0.3)'`.
     * Both map to `var(--brand-primary-a30)`.
     *
     * Must NOT include the canonical `replaces` string (that would be a no-op
     * and signals a mistake in the entry definition).
     */
    replacesVariants: z.array(z.string().min(1)).optional()
});

// ============================================================================
// Map schema with duplicate-detection refinements
// ============================================================================

/**
 * Zod schema for the complete VARIANT_TOKEN_MAP array.
 *
 * Array-level invariants enforced by refinements:
 * 1. No two entries may share the same `name` (CSS custom property collision).
 * 2. No two entries may share the same `replaces` string (codemod ambiguity).
 *    Note: `replacesVariants` are not checked for cross-entry duplicates here
 *    because they are additive codemod targets, not primary identifiers.
 *
 * @example
 * ```ts
 * // Validation in tests:
 * VariantTokenMapSchema.parse(VARIANT_TOKEN_MAP);
 * ```
 *
 * @see VariantTokenEntrySchema for per-entry field contracts.
 */
export const VariantTokenMapSchema = z
    .array(VariantTokenEntrySchema)
    .refine((entries) => new Set(entries.map((e) => e.name)).size === entries.length, {
        message: 'VARIANT_TOKEN_MAP contains duplicate token names — CSS collision detected'
    })
    .refine((entries) => new Set(entries.map((e) => e.replaces)).size === entries.length, {
        message:
            'VARIANT_TOKEN_MAP contains duplicate "replaces" expressions — codemod would be ambiguous'
    });

// ============================================================================
// Inferred TypeScript type
// ============================================================================

/**
 * TypeScript type inferred from `VariantTokenEntrySchema`.
 *
 * Use this type to annotate variables and function parameters that accept a
 * single entry from `VARIANT_TOKEN_MAP`. The schema is the single source of
 * truth; this type is a derived artifact, not an independently maintained
 * interface.
 *
 * @example
 * ```ts
 * import type { VariantTokenEntry } from './variant-token-schema.ts';
 *
 * function processEntry(entry: VariantTokenEntry): string {
 *   return `--${entry.name}: var(--${entry.base})`;
 * }
 * ```
 */
export type VariantTokenEntry = z.infer<typeof VariantTokenEntrySchema>;

/**
 * TypeScript type for the complete VARIANT_TOKEN_MAP.
 * Equivalent to `ReadonlyArray<VariantTokenEntry>` with schema-derived fields.
 */
export type VariantTokenMap = z.infer<typeof VariantTokenMapSchema>;
