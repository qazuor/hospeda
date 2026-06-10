/**
 * @file generators/variant-tokens-alpha.ts
 * @description SPEC-176 T-003 (consolidated) — Alpha-family entries for VARIANT_TOKEN_MAP.
 *
 * Contains 104 alpha-family entries: 92 conservatively-consolidated entries from the
 * initial CSS scan of apps/web/src/, plus 12 FAITHFUL kept-own entries added in T-005
 * part C to close real var-with-fallback alpha-gaps (exact value, no snapping).
 * Imported by variant-tokens.ts which assembles the complete VARIANT_TOKEN_MAP.
 *
 * Alpha transform pattern: `oklch(from var(--BASE) l c h / ALPHA)`
 * Naming convention (D6): `{base}-a{NN}` where NN = round(canonicalAlpha * 100),
 * zero-padded to minimum 2 digits.
 *
 * ## Consolidation — conservative ≤0.025 grid
 *
 * The faithful scan produced 116 unique (base, alpha) pairs across 39 distinct alpha
 * values (0.03–1.0). Conservative consolidation snaps each raw value to the nearest
 * canonical grid step IFF |value − step| ≤ 0.025. Values farther than 0.025 from any
 * grid step keep their own token.
 *
 * Grid (14 steps): 0.05, 0.08, 0.10, 0.12, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40,
 *                  0.50, 0.60, 0.75, 0.90
 *
 * Result: 116 → 92 tokens (24 eliminated). 15 merge groups; 19 values kept-own.
 * Maximum snap delta applied: 0.020. All snaps are perceptually imperceptible.
 *
 * The `replaces` field holds the canonical (primary) source literal. `replacesVariants`
 * holds every other literal from source that maps to the same consolidated token.
 * The T-005 codemod must replace ALL of them with `var(--{name})`.
 *
 * ## Kept-own tokens (19 values — no grid step within 0.025)
 * border-a80 (0.80), brand-accent-a45 (0.45), brand-accent-a55 (0.55),
 * brand-accent-a70 (0.70), brand-accent-a80 (0.80), brand-accent-a85 (0.85),
 * brand-primary-a45 (0.45), core-card-a55 (0.55), core-card-a70 (0.70),
 * core-card-a85 (0.85), core-card-a95 (0.95), core-foreground-a45 (0.45),
 * core-foreground-a55 (0.55), core-foreground-a72 (0.72), core-foreground-a82 (0.82),
 * core-muted-foreground-a85 (0.85), destructive-a80 (0.80),
 * primary-foreground-a80 (0.80), primary-foreground-a85 (0.85).
 *
 * @see variant-tokens.ts for assembly and VARIANT_TOKEN_MAP export.
 * @see variant-token-schema.ts for the VariantTokenEntry type.
 * @see variant-token-derivation.md for derivation methodology and consolidation table.
 */

import type { VariantTokenEntry } from './variant-token-schema.js';

/**
 * All 104 alpha-family variant token entries (92 consolidated + 12 FAITHFUL kept-own).
 * Sorted by base token name, then by canonical alpha parameter ascending.
 *
 * Merge legend in comments: `[MERGED: 0.xx, 0.yy → canonical step]`.
 * FAITHFUL kept-own entries (T-005 part C) are marked with a `FAITHFUL kept-own` comment.
 */
export const ALPHA_VARIANT_ENTRIES: ReadonlyArray<VariantTokenEntry> = [
    // -------------------------------------------------------------------------
    // accent-foreground — 1 token (1 value: 0.35 → a35 exact)
    // -------------------------------------------------------------------------
    {
        name: 'accent-foreground-a35',
        base: 'accent-foreground',
        family: 'alpha',
        param: 0.35,
        replaces: 'oklch(from var(--accent-foreground) l c h / 0.35)'
    },

    // -------------------------------------------------------------------------
    // border — 6 tokens (6 values; 0.80 kept-own, rest exact grid hits)
    // -------------------------------------------------------------------------
    {
        name: 'border-a30',
        base: 'border',
        family: 'alpha',
        param: 0.3,
        replaces: 'oklch(from var(--border) l c h / 0.3)'
    },
    {
        name: 'border-a35',
        base: 'border',
        family: 'alpha',
        param: 0.35,
        replaces: 'oklch(from var(--border) l c h / 0.35)'
    },
    {
        name: 'border-a40',
        base: 'border',
        family: 'alpha',
        param: 0.4,
        replaces: 'oklch(from var(--border) l c h / 0.4)'
    },
    {
        name: 'border-a50',
        base: 'border',
        family: 'alpha',
        param: 0.5,
        replaces: 'oklch(from var(--border) l c h / 0.5)'
    },
    {
        name: 'border-a60',
        base: 'border',
        family: 'alpha',
        param: 0.6,
        replaces: 'oklch(from var(--border) l c h / 0.6)'
    },
    // kept-own: 0.80 — nearest grid step is 0.75 (delta=0.05 > 0.025) and 0.90 (delta=0.10 > 0.025)
    {
        name: 'border-a80',
        base: 'border',
        family: 'alpha',
        param: 0.8,
        replaces: 'oklch(from var(--border) l c h / 0.8)'
    },

    // -------------------------------------------------------------------------
    // brand-accent — 13 tokens (was 25; 12 merged into 6 groups)
    //
    // MERGED: 0.04, 0.06 → a05 (delta 0.01)
    // MERGED: 0.07, 0.08 → a08 (delta 0.01)
    // MERGED: 0.14, 0.15, 0.16 → a15 (delta 0.01)
    // MERGED: 0.18, 0.20, 0.22 → a20 (delta 0.02)
    // MERGED: 0.28, 0.30, 0.32 → a30 (delta 0.02)
    // MERGED: 0.40, 0.42 → a40 (delta 0.02)
    // KEPT-OWN: 0.45, 0.55, 0.70, 0.80, 0.85
    // -------------------------------------------------------------------------
    // [MERGED: 0.04, 0.06 → 0.05] — neither is 0.05 exactly; use 0.04 as primary (smaller)
    {
        name: 'brand-accent-a05',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.05,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.04)',
        replacesVariants: ['oklch(from var(--brand-accent) l c h / 0.06)']
    },
    // [MERGED: 0.07, 0.08 → 0.08] — 0.08 is the grid step and IS in source
    {
        name: 'brand-accent-a08',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.08,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.08)',
        replacesVariants: ['oklch(from var(--brand-accent) l c h / 0.07)']
    },
    // exact grid hit
    {
        name: 'brand-accent-a10',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.1,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.1)'
    },
    // exact grid hit
    {
        name: 'brand-accent-a12',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.12,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.12)'
    },
    // [MERGED: 0.14, 0.15, 0.16 → 0.15] — 0.15 is the grid step and IS in source
    {
        name: 'brand-accent-a15',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.15,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.15)',
        replacesVariants: [
            'oklch(from var(--brand-accent) l c h / 0.14)',
            'oklch(from var(--brand-accent) l c h / 0.16)'
        ]
    },
    // [MERGED: 0.18, 0.20, 0.22 → 0.20] — 0.20 is the grid step and IS in source
    {
        name: 'brand-accent-a20',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.2,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.2)',
        replacesVariants: [
            'oklch(from var(--brand-accent) l c h / 0.18)',
            'oklch(from var(--brand-accent) l c h / 0.22)'
        ]
    },
    // exact grid hit
    {
        name: 'brand-accent-a25',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.25,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.25)'
    },
    // [MERGED: 0.28, 0.30, 0.32 → 0.30] — 0.30 is the grid step and IS in source
    // Note: source also has literal '0.30' (trailing zero) → included in replacesVariants
    {
        name: 'brand-accent-a30',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.3,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.3)',
        replacesVariants: [
            'oklch(from var(--brand-accent) l c h / 0.28)',
            'oklch(from var(--brand-accent) l c h / 0.30)',
            'oklch(from var(--brand-accent) l c h / 0.32)'
        ]
    },
    // exact grid hit
    {
        name: 'brand-accent-a35',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.35,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.35)'
    },
    // [MERGED: 0.40, 0.42 → 0.40] — 0.40 is the grid step and IS in source
    {
        name: 'brand-accent-a40',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.4,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.4)',
        replacesVariants: ['oklch(from var(--brand-accent) l c h / 0.42)']
    },
    // kept-own: 0.45 — nearest grid steps are 0.40 (delta=0.05) and 0.50 (delta=0.05)
    {
        name: 'brand-accent-a45',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.45,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.45)'
    },
    // exact grid hit
    {
        name: 'brand-accent-a50',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.5,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.5)'
    },
    // kept-own: 0.55 — nearest grid steps are 0.50 (delta=0.05) and 0.60 (delta=0.05)
    {
        name: 'brand-accent-a55',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.55,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.55)'
    },
    // kept-own: 0.70 — nearest grid steps are 0.60 (delta=0.10) and 0.75 (delta=0.05)
    {
        name: 'brand-accent-a70',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.7,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.7)'
    },
    // kept-own: 0.80 — nearest grid steps are 0.75 (delta=0.05) and 0.90 (delta=0.10)
    {
        name: 'brand-accent-a80',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.8,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.8)'
    },
    // kept-own: 0.85 — nearest grid steps are 0.75 (delta=0.10) and 0.90 (delta=0.05)
    {
        name: 'brand-accent-a85',
        base: 'brand-accent',
        family: 'alpha',
        param: 0.85,
        replaces: 'oklch(from var(--brand-accent) l c h / 0.85)'
    },

    // -------------------------------------------------------------------------
    // brand-primary — 11 tokens (was 21; 10 merged into 5 groups)
    //
    // MERGED: 0.03, 0.04, 0.05, 0.06 → a05 (delta 0.02)
    // MERGED: 0.14, 0.15, 0.16 → a15 (delta 0.01)
    // MERGED: 0.18, 0.20, 0.22 → a20 (delta 0.02)
    // MERGED: 0.25, 0.26 → a25 (delta 0.01)
    // MERGED: 0.28, 0.30, 0.32 → a30 (delta 0.02)
    // KEPT-OWN: 0.45
    // -------------------------------------------------------------------------
    // [MERGED: 0.03, 0.04, 0.05, 0.06 → 0.05] — 0.05 IS in source; primary = 0.05
    {
        name: 'brand-primary-a05',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.05,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.05)',
        replacesVariants: [
            'oklch(from var(--brand-primary) l c h / 0.03)',
            'oklch(from var(--brand-primary) l c h / 0.04)',
            'oklch(from var(--brand-primary) l c h / 0.06)'
        ]
    },
    // exact grid hit
    {
        name: 'brand-primary-a08',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.08,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.08)'
    },
    // exact grid hit
    {
        name: 'brand-primary-a10',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.1,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.1)'
    },
    // exact grid hit
    {
        name: 'brand-primary-a12',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.12,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.12)'
    },
    // [MERGED: 0.14, 0.15, 0.16 → 0.15] — 0.15 IS in source; primary = 0.15
    {
        name: 'brand-primary-a15',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.15,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.15)',
        replacesVariants: [
            'oklch(from var(--brand-primary) l c h / 0.14)',
            'oklch(from var(--brand-primary) l c h / 0.16)'
        ]
    },
    // [MERGED: 0.18, 0.20, 0.22 → 0.20] — 0.20 IS in source; primary = 0.20
    {
        name: 'brand-primary-a20',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.2,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.2)',
        replacesVariants: [
            'oklch(from var(--brand-primary) l c h / 0.18)',
            'oklch(from var(--brand-primary) l c h / 0.22)'
        ]
    },
    // [MERGED: 0.25, 0.26 → 0.25] — 0.25 IS in source; primary = 0.25
    {
        name: 'brand-primary-a25',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.25,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.25)',
        replacesVariants: ['oklch(from var(--brand-primary) l c h / 0.26)']
    },
    // [MERGED: 0.28, 0.30, 0.32 → 0.30] — 0.30 IS in source; primary = 0.30
    // Note: source also has literal '0.30' (trailing zero) → included in replacesVariants
    {
        name: 'brand-primary-a30',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.3,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.3)',
        replacesVariants: [
            'oklch(from var(--brand-primary) l c h / 0.28)',
            'oklch(from var(--brand-primary) l c h / 0.30)',
            'oklch(from var(--brand-primary) l c h / 0.32)'
        ]
    },
    // exact grid hit
    {
        name: 'brand-primary-a35',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.35,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.35)'
    },
    // exact grid hit
    {
        name: 'brand-primary-a40',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.4,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.4)'
    },
    // kept-own: 0.45 — nearest grid steps are 0.40 (delta=0.05) and 0.50 (delta=0.05)
    {
        name: 'brand-primary-a45',
        base: 'brand-primary',
        family: 'alpha',
        param: 0.45,
        replaces: 'oklch(from var(--brand-primary) l c h / 0.45)'
    },

    // -------------------------------------------------------------------------
    // core-background — 1 token (1 value: 0.40 exact grid hit)
    // -------------------------------------------------------------------------
    {
        name: 'core-background-a40',
        base: 'core-background',
        family: 'alpha',
        param: 0.4,
        replaces: 'oklch(from var(--core-background) l c h / 0.4)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.70 — fills var-fallback alpha-gap
    // (PaginationLoading overlay). Nearest existing a40 (0.40) delta 0.30 > 0.025.
    {
        name: 'core-background-a70',
        base: 'core-background',
        family: 'alpha',
        param: 0.7,
        replaces: 'oklch(from var(--core-background) l c h / 0.7)'
    },

    // -------------------------------------------------------------------------
    // core-card — 8 tokens (was 9; 1 merge group)
    //
    // MERGED: 0.90, 0.92 → a90 (delta 0.02)
    // KEPT-OWN: 0.55, 0.70, 0.85, 0.95
    // a100: alpha=1.0 (opaque, always kept)
    // -------------------------------------------------------------------------
    // FAITHFUL kept-own (T-005 part C): 0.25 — fills var-fallback alpha-gap
    // (NewsletterForm). Nearest existing a55 (0.55) delta 0.30 > 0.025.
    {
        name: 'core-card-a25',
        base: 'core-card',
        family: 'alpha',
        param: 0.25,
        replaces: 'oklch(from var(--core-card) l c h / 0.25)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.30 — fills var-fallback alpha-gap
    // (NewsletterForm). Nearest existing a55 (0.55) delta 0.25 > 0.025.
    {
        name: 'core-card-a30',
        base: 'core-card',
        family: 'alpha',
        param: 0.3,
        replaces: 'oklch(from var(--core-card) l c h / 0.3)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.50 — fills var-fallback alpha-gap
    // (NewsletterForm). Nearest existing a55 (0.55) delta 0.05 > 0.025.
    {
        name: 'core-card-a50',
        base: 'core-card',
        family: 'alpha',
        param: 0.5,
        replaces: 'oklch(from var(--core-card) l c h / 0.5)'
    },
    // kept-own: 0.55 — nearest grid steps are 0.50 (delta=0.05) and 0.60 (delta=0.05)
    {
        name: 'core-card-a55',
        base: 'core-card',
        family: 'alpha',
        param: 0.55,
        replaces: 'oklch(from var(--core-card) l c h / 0.55)'
    },
    // exact grid hit
    {
        name: 'core-card-a60',
        base: 'core-card',
        family: 'alpha',
        param: 0.6,
        replaces: 'oklch(from var(--core-card) l c h / 0.6)'
    },
    // kept-own: 0.70 — nearest grid steps are 0.60 (delta=0.10) and 0.75 (delta=0.05)
    {
        name: 'core-card-a70',
        base: 'core-card',
        family: 'alpha',
        param: 0.7,
        replaces: 'oklch(from var(--core-card) l c h / 0.7)'
    },
    // exact grid hit
    {
        name: 'core-card-a75',
        base: 'core-card',
        family: 'alpha',
        param: 0.75,
        replaces: 'oklch(from var(--core-card) l c h / 0.75)'
    },
    // kept-own: 0.85 — nearest grid steps are 0.75 (delta=0.10) and 0.90 (delta=0.05)
    {
        name: 'core-card-a85',
        base: 'core-card',
        family: 'alpha',
        param: 0.85,
        replaces: 'oklch(from var(--core-card) l c h / 0.85)'
    },
    // [MERGED: 0.90, 0.92 → 0.90] — 0.90 IS in source; primary = 0.90
    {
        name: 'core-card-a90',
        base: 'core-card',
        family: 'alpha',
        param: 0.9,
        replaces: 'oklch(from var(--core-card) l c h / 0.9)',
        replacesVariants: ['oklch(from var(--core-card) l c h / 0.92)']
    },
    // kept-own: 0.95 — nearest grid steps are 0.90 (delta=0.05) and no closer step
    {
        name: 'core-card-a95',
        base: 'core-card',
        family: 'alpha',
        param: 0.95,
        replaces: 'oklch(from var(--core-card) l c h / 0.95)'
    },
    // alpha=1 (opaque) — always its own token; D6 name a100
    {
        name: 'core-card-a100',
        base: 'core-card',
        family: 'alpha',
        param: 1.0,
        replaces: 'oklch(from var(--core-card) l c h / 1)'
    },

    // -------------------------------------------------------------------------
    // core-foreground — 14 tokens (was 19; 5 merged into 3 groups; 5 kept-own)
    //
    // MERGED: 0.04, 0.05, 0.06 → a05 (delta 0.01)
    // MERGED: 0.07, 0.08 → a08 (delta 0.01)
    // MERGED: 0.18, 0.20 → a20 (delta 0.02)
    // KEPT-OWN: 0.45, 0.55, 0.72, 0.82
    // NOTE: 0.92 snaps to a90 (delta=0.02 ≤ 0.025) — token name a90, replaces='0.92'
    // -------------------------------------------------------------------------
    // [MERGED: 0.04, 0.05, 0.06 → 0.05] — 0.05 IS in source; primary = 0.05
    {
        name: 'core-foreground-a05',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.05,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.05)',
        replacesVariants: [
            'oklch(from var(--core-foreground) l c h / 0.04)',
            'oklch(from var(--core-foreground) l c h / 0.06)'
        ]
    },
    // [MERGED: 0.07, 0.08 → 0.08] — 0.08 IS in source; primary = 0.08
    {
        name: 'core-foreground-a08',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.08,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.08)',
        replacesVariants: ['oklch(from var(--core-foreground) l c h / 0.07)']
    },
    // exact grid hit
    {
        name: 'core-foreground-a10',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.1,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.1)'
    },
    // exact grid hit
    {
        name: 'core-foreground-a12',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.12,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.12)'
    },
    // exact grid hit
    {
        name: 'core-foreground-a15',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.15,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.15)'
    },
    // [MERGED: 0.18, 0.20 → 0.20] — 0.20 IS in source; primary = 0.20
    {
        name: 'core-foreground-a20',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.2,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.2)',
        replacesVariants: ['oklch(from var(--core-foreground) l c h / 0.18)']
    },
    // exact grid hit
    {
        name: 'core-foreground-a25',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.25,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.25)'
    },
    // exact grid hit
    {
        name: 'core-foreground-a30',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.3,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.3)'
    },
    // exact grid hit
    {
        name: 'core-foreground-a40',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.4,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.4)'
    },
    // kept-own: 0.45 — nearest grid steps are 0.40 (delta=0.05) and 0.50 (delta=0.05)
    {
        name: 'core-foreground-a45',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.45,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.45)'
    },
    // exact grid hit
    {
        name: 'core-foreground-a50',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.5,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.5)'
    },
    // kept-own: 0.55 — nearest grid steps are 0.50 (delta=0.05) and 0.60 (delta=0.05)
    {
        name: 'core-foreground-a55',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.55,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.55)'
    },
    // kept-own: 0.72 — nearest grid steps are 0.60 (delta=0.12) and 0.75 (delta=0.03 > 0.025)
    {
        name: 'core-foreground-a72',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.72,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.72)'
    },
    // exact grid hit
    {
        name: 'core-foreground-a75',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.75,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.75)'
    },
    // kept-own: 0.82 — nearest grid steps are 0.75 (delta=0.07) and 0.90 (delta=0.08)
    {
        name: 'core-foreground-a82',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.82,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.82)'
    },
    // 0.92 snaps to 0.90 (delta=0.02 ≤ 0.025) — token named a90; replaces = source literal '0.92'
    {
        name: 'core-foreground-a90',
        base: 'core-foreground',
        family: 'alpha',
        param: 0.9,
        replaces: 'oklch(from var(--core-foreground) l c h / 0.92)'
    },

    // -------------------------------------------------------------------------
    // core-muted-foreground — 11 tokens (11 values; only a85 kept-own)
    //
    // KEPT-OWN: 0.85
    // All other values hit grid exactly.
    // Note: 0.20 also has source spelling '0.20' → replacesVariants
    // -------------------------------------------------------------------------
    // exact grid hit
    {
        name: 'core-muted-foreground-a08',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.08,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.08)'
    },
    // exact grid hit
    {
        name: 'core-muted-foreground-a12',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.12,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.12)'
    },
    // exact grid hit
    {
        name: 'core-muted-foreground-a15',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.15,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.15)'
    },
    // exact grid hit; spelling variant '0.20' also present in source
    {
        name: 'core-muted-foreground-a20',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.2,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.2)',
        replacesVariants: ['oklch(from var(--core-muted-foreground) l c h / 0.20)']
    },
    // exact grid hit
    {
        name: 'core-muted-foreground-a25',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.25,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.25)'
    },
    // exact grid hit
    {
        name: 'core-muted-foreground-a30',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.3,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.3)'
    },
    // exact grid hit
    {
        name: 'core-muted-foreground-a35',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.35,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.35)'
    },
    // exact grid hit
    {
        name: 'core-muted-foreground-a40',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.4,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.4)'
    },
    // exact grid hit
    {
        name: 'core-muted-foreground-a50',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.5,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.5)'
    },
    // exact grid hit
    {
        name: 'core-muted-foreground-a60',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.6,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.6)'
    },
    // kept-own: 0.85 — nearest grid steps are 0.75 (delta=0.10) and 0.90 (delta=0.05)
    {
        name: 'core-muted-foreground-a85',
        base: 'core-muted-foreground',
        family: 'alpha',
        param: 0.85,
        replaces: 'oklch(from var(--core-muted-foreground) l c h / 0.85)'
    },

    // -------------------------------------------------------------------------
    // destructive — 11 tokens (7 grid + 4 FAITHFUL kept-own from T-005 part C)
    // -------------------------------------------------------------------------
    // FAITHFUL kept-own (T-005 part C): 0.04 — fills var-fallback alpha-gap
    // (ErrorBanner). Nearest existing a08 (0.08) delta 0.04 > 0.025.
    {
        name: 'destructive-a04',
        base: 'destructive',
        family: 'alpha',
        param: 0.04,
        replaces: 'oklch(from var(--destructive) l c h / 0.04)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.05 — fills var-fallback alpha-gap
    // (ErrorBanner). Nearest existing a08 (0.08) delta 0.03 > 0.025.
    {
        name: 'destructive-a05',
        base: 'destructive',
        family: 'alpha',
        param: 0.05,
        replaces: 'oklch(from var(--destructive) l c h / 0.05)'
    },
    // exact grid hit
    {
        name: 'destructive-a08',
        base: 'destructive',
        family: 'alpha',
        param: 0.08,
        replaces: 'oklch(from var(--destructive) l c h / 0.08)'
    },
    // exact grid hit
    {
        name: 'destructive-a10',
        base: 'destructive',
        family: 'alpha',
        param: 0.1,
        replaces: 'oklch(from var(--destructive) l c h / 0.1)'
    },
    // exact grid hit
    {
        name: 'destructive-a12',
        base: 'destructive',
        family: 'alpha',
        param: 0.12,
        replaces: 'oklch(from var(--destructive) l c h / 0.12)'
    },
    // exact grid hit
    {
        name: 'destructive-a15',
        base: 'destructive',
        family: 'alpha',
        param: 0.15,
        replaces: 'oklch(from var(--destructive) l c h / 0.15)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.18 — fills var-fallback alpha-gap
    // (ContactForm, components.css). Nearest existing a15 (0.15) delta 0.03 > 0.025.
    {
        name: 'destructive-a18',
        base: 'destructive',
        family: 'alpha',
        param: 0.18,
        replaces: 'oklch(from var(--destructive) l c h / 0.18)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.25 — fills var-fallback alpha-gap
    // (12 occurrences; account/* error surfaces). Nearest existing a15/a35 delta 0.10 > 0.025.
    {
        name: 'destructive-a25',
        base: 'destructive',
        family: 'alpha',
        param: 0.25,
        replaces: 'oklch(from var(--destructive) l c h / 0.25)'
    },
    // exact grid hit
    {
        name: 'destructive-a35',
        base: 'destructive',
        family: 'alpha',
        param: 0.35,
        replaces: 'oklch(from var(--destructive) l c h / 0.35)'
    },
    // exact grid hit
    {
        name: 'destructive-a50',
        base: 'destructive',
        family: 'alpha',
        param: 0.5,
        replaces: 'oklch(from var(--destructive) l c h / 0.5)'
    },
    // kept-own: 0.80 — nearest grid steps are 0.75 (delta=0.05) and 0.90 (delta=0.10)
    {
        name: 'destructive-a80',
        base: 'destructive',
        family: 'alpha',
        param: 0.8,
        replaces: 'oklch(from var(--destructive) l c h / 0.8)'
    },

    // -------------------------------------------------------------------------
    // footer-fg — 3 tokens (3 values; all exact grid hits)
    // -------------------------------------------------------------------------
    {
        name: 'footer-fg-a08',
        base: 'footer-fg',
        family: 'alpha',
        param: 0.08,
        replaces: 'oklch(from var(--footer-fg) l c h / 0.08)'
    },
    {
        name: 'footer-fg-a12',
        base: 'footer-fg',
        family: 'alpha',
        param: 0.12,
        replaces: 'oklch(from var(--footer-fg) l c h / 0.12)'
    },
    {
        name: 'footer-fg-a50',
        base: 'footer-fg',
        family: 'alpha',
        param: 0.5,
        replaces: 'oklch(from var(--footer-fg) l c h / 0.5)'
    },

    // -------------------------------------------------------------------------
    // hospeda-sky — 1 token (1 value: 0.15 exact grid hit)
    // -------------------------------------------------------------------------
    {
        name: 'hospeda-sky-a15',
        base: 'hospeda-sky',
        family: 'alpha',
        param: 0.15,
        replaces: 'oklch(from var(--hospeda-sky) l c h / 0.15)'
    },

    // -------------------------------------------------------------------------
    // info — 1 token (1 value: 0.08 exact grid hit)
    // -------------------------------------------------------------------------
    {
        name: 'info-a08',
        base: 'info',
        family: 'alpha',
        param: 0.08,
        replaces: 'oklch(from var(--info) l c h / 0.08)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.20 — fills var-fallback alpha-gap
    // (ToastViewport). Nearest existing a08 (0.08) delta 0.12 > 0.025.
    {
        name: 'info-a20',
        base: 'info',
        family: 'alpha',
        param: 0.2,
        replaces: 'oklch(from var(--info) l c h / 0.2)'
    },

    // -------------------------------------------------------------------------
    // primary-foreground — 4 tokens (4 values; 0.80 and 0.85 kept-own)
    // -------------------------------------------------------------------------
    // exact grid hit
    {
        name: 'primary-foreground-a30',
        base: 'primary-foreground',
        family: 'alpha',
        param: 0.3,
        replaces: 'oklch(from var(--primary-foreground) l c h / 0.3)'
    },
    // exact grid hit
    {
        name: 'primary-foreground-a75',
        base: 'primary-foreground',
        family: 'alpha',
        param: 0.75,
        replaces: 'oklch(from var(--primary-foreground) l c h / 0.75)'
    },
    // kept-own: 0.80 — nearest grid steps are 0.75 (delta=0.05) and 0.90 (delta=0.10)
    {
        name: 'primary-foreground-a80',
        base: 'primary-foreground',
        family: 'alpha',
        param: 0.8,
        replaces: 'oklch(from var(--primary-foreground) l c h / 0.8)'
    },
    // kept-own: 0.85 — nearest grid steps are 0.75 (delta=0.10) and 0.90 (delta=0.05)
    {
        name: 'primary-foreground-a85',
        base: 'primary-foreground',
        family: 'alpha',
        param: 0.85,
        replaces: 'oklch(from var(--primary-foreground) l c h / 0.85)'
    },

    // -------------------------------------------------------------------------
    // ring — 1 token (1 value: 0.50 exact grid hit)
    // -------------------------------------------------------------------------
    {
        name: 'ring-a50',
        base: 'ring',
        family: 'alpha',
        param: 0.5,
        replaces: 'oklch(from var(--ring) l c h / 0.5)'
    },

    // -------------------------------------------------------------------------
    // success — 3 tokens (1 grid + 2 FAITHFUL kept-own from T-005 part C)
    // -------------------------------------------------------------------------
    {
        name: 'success-a12',
        base: 'success',
        family: 'alpha',
        param: 0.12,
        replaces: 'oklch(from var(--success) l c h / 0.12)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.15 — fills var-fallback alpha-gap
    // (SubscriptionDashboard). Nearest existing a12 (0.12) delta 0.03 > 0.025.
    {
        name: 'success-a15',
        base: 'success',
        family: 'alpha',
        param: 0.15,
        replaces: 'oklch(from var(--success) l c h / 0.15)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.30 — fills var-fallback alpha-gap
    // (SubscriptionDashboard). Nearest existing a12 (0.12) delta 0.18 > 0.025.
    {
        name: 'success-a30',
        base: 'success',
        family: 'alpha',
        param: 0.3,
        replaces: 'oklch(from var(--success) l c h / 0.3)'
    },

    // -------------------------------------------------------------------------
    // surface-dark — 1 token (1 value: 0.40 exact grid hit)
    // -------------------------------------------------------------------------
    {
        name: 'surface-dark-a40',
        base: 'surface-dark',
        family: 'alpha',
        param: 0.4,
        replaces: 'oklch(from var(--surface-dark) l c h / 0.4)'
    },

    // -------------------------------------------------------------------------
    // surface-dark-foreground — 1 token (1 value: 0.75 exact grid hit)
    // -------------------------------------------------------------------------
    {
        name: 'surface-dark-foreground-a75',
        base: 'surface-dark-foreground',
        family: 'alpha',
        param: 0.75,
        replaces: 'oklch(from var(--surface-dark-foreground) l c h / 0.75)'
    },

    // -------------------------------------------------------------------------
    // warning — 3 tokens (2 grid + 1 FAITHFUL kept-own from T-005 part C)
    // -------------------------------------------------------------------------
    {
        name: 'warning-a10',
        base: 'warning',
        family: 'alpha',
        param: 0.1,
        replaces: 'oklch(from var(--warning) l c h / 0.1)'
    },
    {
        name: 'warning-a12',
        base: 'warning',
        family: 'alpha',
        param: 0.12,
        replaces: 'oklch(from var(--warning) l c h / 0.12)'
    },
    // FAITHFUL kept-own (T-005 part C): 0.35 — fills var-fallback alpha-gap
    // (ArticleCard, publicaciones/[slug]). Nearest existing a12 (0.12) delta 0.23 > 0.025.
    {
        name: 'warning-a35',
        base: 'warning',
        family: 'alpha',
        param: 0.35,
        replaces: 'oklch(from var(--warning) l c h / 0.35)'
    }
] as const;
