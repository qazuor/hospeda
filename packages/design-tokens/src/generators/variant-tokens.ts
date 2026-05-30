/**
 * @file generators/variant-tokens.ts
 * @description SPEC-176 T-003 (consolidated) — Complete VARIANT_TOKEN_MAP with all 128 entries.
 *
 * This file assembles the VARIANT_TOKEN_MAP from two modules:
 * - `variant-tokens-alpha.ts` — 104 alpha-family entries (92 consolidated + 12 FAITHFUL
 *   kept-own added in T-005 part C to close var-fallback alpha-gaps)
 * - This file — 1 white-origin alpha entry + 23 lightness-family entries
 *   (multiply × 11, subtract × 10, add × 2)
 *
 * Every entry was derived by scanning `apps/web/src/` for `oklch(from var(--BASE) TRANSFORM)`
 * patterns (plus the single `oklch(from white l c h / 0.75)` white-origin usage).
 * The faithful scan found 116 var-based alpha pairs; consolidation reduced them to 92.
 *
 *   - 92 alpha-family (consolidated from 116; 15 merge groups, max snap delta 0.020)
 *   - 12 alpha-family FAITHFUL kept-own (T-005 part C; close var-fallback alpha-gaps)
 *   -  1 white-origin alpha (oklch(from white l c h / 0.75)) — SPEC-176 T-005 part A
 *   - 11 lightness-multiply (base, factor) pairs — FAITHFUL 1:1 (incl. muted-l105 part C)
 *   - 10 lightness-subtract (base, offset) pairs — FAITHFUL 1:1, unchanged
 *   -  2 lightness-add (base, offset) pairs — FAITHFUL 1:1, unchanged
 *   = 128 total canonical entries
 *
 * Alpha consolidation grid (14 steps): 0.05, 0.08, 0.10, 0.12, 0.15, 0.20, 0.25,
 *   0.30, 0.35, 0.40, 0.50, 0.60, 0.75, 0.90.
 * Snap rule: snap only if |value − step| ≤ 0.025. Values farther than 0.025 keep own token.
 *
 * The `replaces` field holds the canonical spelling; `replacesVariants` holds
 * additional literal forms. T-005's codemod must replace BOTH `replaces` AND
 * each entry in `replacesVariants` with `var(--{name})`.
 *
 * Naming convention (D6 — locked, SPEC-176):
 * - Alpha:              `{base}-a{NN}` — NN = round(canonicalAlpha × 100), min 2 digits.
 * - Lightness-multiply: `{base}-l{NN}` — NN = round(factor × 100).
 * - Lightness-subtract: `{base}-lm{NN}` — NN = round(offset × 100).
 * - Lightness-add:      `{base}-lp{NN}` — NN = round(offset × 100).
 *
 * @see variant-tokens-alpha.ts for the 92 alpha-family entries.
 * @see variant-token-schema.ts for the Zod schema and VariantTokenEntry type.
 * @see generate-css.ts (T-004) for the CSS emitter that consumes this map.
 * @see scripts/codemod-relative-colors.mjs (T-005) for the codemod.
 * @see variant-token-derivation.md for derivation methodology and consolidation table.
 */

import type { VariantTokenEntry } from './variant-token-schema.js';
import { ALPHA_VARIANT_ENTRIES } from './variant-tokens-alpha.js';

// ============================================================================
// Lightness-multiply family — oklch(from var(--BASE) calc(l * FACTOR) c h)
// 11 entries, sorted by base then factor.
// ============================================================================

const LIGHTNESS_MULTIPLY_ENTRIES: ReadonlyArray<VariantTokenEntry> = [
    // --- brand-accent ---
    {
        name: 'brand-accent-l82',
        base: 'brand-accent',
        family: 'lightness-multiply',
        param: 0.82,
        replaces: 'oklch(from var(--brand-accent) calc(l * 0.82) c h)'
    },
    {
        name: 'brand-accent-l90',
        base: 'brand-accent',
        family: 'lightness-multiply',
        param: 0.9,
        replaces: 'oklch(from var(--brand-accent) calc(l * 0.9) c h)'
    },
    {
        name: 'brand-accent-l112',
        base: 'brand-accent',
        family: 'lightness-multiply',
        param: 1.12,
        replaces: 'oklch(from var(--brand-accent) calc(l * 1.12) c h)'
    },

    // --- brand-primary ---
    {
        name: 'brand-primary-l80',
        base: 'brand-primary',
        family: 'lightness-multiply',
        param: 0.8,
        replaces: 'oklch(from var(--brand-primary) calc(l * 0.8) c h)'
    },
    {
        name: 'brand-primary-l85',
        base: 'brand-primary',
        family: 'lightness-multiply',
        param: 0.85,
        replaces: 'oklch(from var(--brand-primary) calc(l * 0.85) c h)'
    },
    {
        name: 'brand-primary-l90',
        base: 'brand-primary',
        family: 'lightness-multiply',
        param: 0.9,
        replaces: 'oklch(from var(--brand-primary) calc(l * 0.9) c h)'
    },
    {
        name: 'brand-primary-l115',
        base: 'brand-primary',
        family: 'lightness-multiply',
        param: 1.15,
        replaces: 'oklch(from var(--brand-primary) calc(l * 1.15) c h)'
    },

    // --- core-card ---
    {
        name: 'core-card-l97',
        base: 'core-card',
        family: 'lightness-multiply',
        param: 0.97,
        replaces: 'oklch(from var(--core-card) calc(l * 0.97) c h)'
    },

    // --- core-foreground ---
    {
        name: 'core-foreground-l115',
        base: 'core-foreground',
        family: 'lightness-multiply',
        param: 1.15,
        replaces: 'oklch(from var(--core-foreground) calc(l * 1.15) c h)'
    },

    // --- destructive ---
    {
        name: 'destructive-l85',
        base: 'destructive',
        family: 'lightness-multiply',
        param: 0.85,
        replaces: 'oklch(from var(--destructive) calc(l * 0.85) c h)'
    },

    // --- muted ---
    // FAITHFUL (T-005 part C): brightens --muted by 5% for the login shimmer
    // (auth SignIn/SignUp, 6 usages). The source spells the fallback inline as
    // `oklch(from var(--muted, oklch(0.93 0 0)) calc(l * 1.05) c h)`; the codemod
    // normalizes the var() fallback away before matching this canonical literal.
    {
        name: 'muted-l105',
        base: 'muted',
        family: 'lightness-multiply',
        param: 1.05,
        replaces: 'oklch(from var(--muted) calc(l * 1.05) c h)'
    }
] as const;

// ============================================================================
// Lightness-subtract family — oklch(from var(--BASE) calc(l - OFFSET) c h)
// 10 entries, sorted by base then offset.
// ============================================================================

const LIGHTNESS_SUBTRACT_ENTRIES: ReadonlyArray<VariantTokenEntry> = [
    // --- border ---
    {
        name: 'border-lm05',
        base: 'border',
        family: 'lightness-subtract',
        param: 0.05,
        replaces: 'oklch(from var(--border) calc(l - 0.05) c h)'
    },

    // --- brand-accent ---
    {
        name: 'brand-accent-lm04',
        base: 'brand-accent',
        family: 'lightness-subtract',
        param: 0.04,
        replaces: 'oklch(from var(--brand-accent) calc(l - 0.04) c h)'
    },
    {
        name: 'brand-accent-lm05',
        base: 'brand-accent',
        family: 'lightness-subtract',
        param: 0.05,
        replaces: 'oklch(from var(--brand-accent) calc(l - 0.05) c h)'
    },
    {
        name: 'brand-accent-lm06',
        base: 'brand-accent',
        family: 'lightness-subtract',
        param: 0.06,
        replaces: 'oklch(from var(--brand-accent) calc(l - 0.06) c h)'
    },
    {
        name: 'brand-accent-lm15',
        base: 'brand-accent',
        family: 'lightness-subtract',
        param: 0.15,
        replaces: 'oklch(from var(--brand-accent) calc(l - 0.15) c h)'
    },

    // --- brand-primary ---
    {
        name: 'brand-primary-lm05',
        base: 'brand-primary',
        family: 'lightness-subtract',
        param: 0.05,
        replaces: 'oklch(from var(--brand-primary) calc(l - 0.05) c h)'
    },
    {
        name: 'brand-primary-lm06',
        base: 'brand-primary',
        family: 'lightness-subtract',
        param: 0.06,
        replaces: 'oklch(from var(--brand-primary) calc(l - 0.06) c h)'
    },
    {
        name: 'brand-primary-lm12',
        base: 'brand-primary',
        family: 'lightness-subtract',
        param: 0.12,
        replaces: 'oklch(from var(--brand-primary) calc(l - 0.12) c h)'
    },

    // --- core-card ---
    {
        name: 'core-card-lm03',
        base: 'core-card',
        family: 'lightness-subtract',
        param: 0.03,
        replaces: 'oklch(from var(--core-card) calc(l - 0.03) c h)'
    },

    // --- destructive ---
    {
        name: 'destructive-lm04',
        base: 'destructive',
        family: 'lightness-subtract',
        param: 0.04,
        replaces: 'oklch(from var(--destructive) calc(l - 0.04) c h)'
    }
] as const;

// ============================================================================
// Lightness-add family — oklch(from var(--BASE) calc(l + OFFSET) c h)
// 2 entries found in gradient-stop usages. Sorted by base then offset.
// ============================================================================

const LIGHTNESS_ADD_ENTRIES: ReadonlyArray<VariantTokenEntry> = [
    // --- brand-primary ---
    {
        name: 'brand-primary-lp10',
        base: 'brand-primary',
        family: 'lightness-add',
        param: 0.1,
        replaces: 'oklch(from var(--brand-primary) calc(l + 0.1) c h)'
    },

    // --- surface-dark ---
    {
        name: 'surface-dark-lp05',
        base: 'surface-dark',
        family: 'lightness-add',
        param: 0.05,
        replaces: 'oklch(from var(--surface-dark) calc(l + 0.05) c h)'
    }
] as const;

// ============================================================================
// White-origin alpha family — oklch(from white l c h / ALPHA)
// 1 entry. SPEC-176 T-005 part A.
//
// Unlike every other alpha entry, the base is the CSS-wide `white` keyword, NOT
// a theme token in webLight. White resolves to a fixed OKLCH of {l:1, c:0, h:0}.
// The emitter (emit-variant-tokens.ts) special-cases base === 'white' so the
// base lookup does not throw (white is not a webLight key).
//
// The 0.95 white-origin literal that exists at components.css:539 is the
// CONDITION of an `@supports` feature-detection probe, NOT a color value, so it
// is intentionally NOT tokenized here.
// ============================================================================

const WHITE_ALPHA_ENTRIES: ReadonlyArray<VariantTokenEntry> = [
    {
        name: 'white-a75',
        base: 'white',
        family: 'alpha',
        param: 0.75,
        replaces: 'oklch(from white l c h / 0.75)'
    }
] as const;

// ============================================================================
// VARIANT_TOKEN_MAP — assembled from all four families
// ============================================================================

/**
 * Ordered list of all 128 variant tokens that need sRGB fallbacks (SPEC-176).
 *
 * Each entry maps a canonical CSS custom property name (`name`) to:
 * - The base theme token it derives from (`base`).
 * - The transform applied (`family` + `param`).
 * - The exact inline `oklch(from ...)` string the T-005 codemod replaces
 *   (`replaces`), plus any alternative literal spellings (`replacesVariants`).
 *
 * T-004 (`emitVariantTokens`) consumes this map to produce:
 * ```css
 * :root { --name: rgb(R G B [/ ALPHA]); }
 * @supports (color: oklch(from white l c h)) { :root { --name: oklch(from var(--base) ...); } }
 * ```
 *
 * T-005 (codemod) consumes `replaces` and `replacesVariants` to swap 676+
 * call-sites in `apps/web/src/` to `var(--name)`.
 *
 * Order: alpha-family (104) → white-origin alpha (1) → lightness-multiply (11)
 * → lightness-subtract (10) → lightness-add (2). Within each family: sorted by
 * base name, then by param.
 *
 * @see variant-tokens-alpha.ts for the 104 alpha entries (split file).
 * @see variant-token-schema.ts — VariantTokenEntry type and VariantTokenMapSchema.
 * @see variant-token-derivation.md — scan methodology and consolidation table.
 */
export const VARIANT_TOKEN_MAP: ReadonlyArray<VariantTokenEntry> = [
    ...ALPHA_VARIANT_ENTRIES,
    ...WHITE_ALPHA_ENTRIES,
    ...LIGHTNESS_MULTIPLY_ENTRIES,
    ...LIGHTNESS_SUBTRACT_ENTRIES,
    ...LIGHTNESS_ADD_ENTRIES
];
