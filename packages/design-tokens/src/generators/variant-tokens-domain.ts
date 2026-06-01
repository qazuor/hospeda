/**
 * @file generators/variant-tokens-domain.ts
 * @description SPEC-176 T-006 — Alpha-family entries for the 63 domain base tokens.
 *
 * Generates 126 entries (63 bases × 2 alpha steps: a15 + a30) for:
 *   - accommodation-type (10 bases)
 *   - amenity-type (12 bases)
 *   - auth-provider (5 bases)
 *   - event-category (8 bases)
 *   - post-category (18 bases)
 *   - sponsor-type (3 bases)
 *   - user-role (7 bases)
 *   = 63 total bases × 2 = 126 entries
 *
 * These entries are needed because the icon domain files (packages/icons/src/domain/*)
 * emit `subtle` color schemes using inline `oklch(from var(--${cssToken}) l c h / 0.15)`
 * and `oklch(from var(--${cssToken}) l c h / 0.3)` relative-color expressions. Chrome 109
 * does not support relative colors, so those badge backgrounds and borders render as
 * transparent/black. By precomputing these alpha variants as sRGB fallback tokens with
 * an @supports oklch override, old-browser users see correct badge colors (SPEC-176 §2).
 *
 * ## Why domain tokens can't use the existing alpha entries
 *
 * All existing ALPHA_VARIANT_ENTRIES (104 entries) have bases that reference OKLCH
 * values directly from `webLight` or via a single `var(--NAME)` where NAME IS in
 * `webLight` as OKLCH. Domain token bases (e.g. `accommodation-type-hotel`) have values
 * of `var(--palette-X-500)` in `webLight`, and `palette-X-500` is NOT a key in `webLight`
 * — it is a palette primitive emitted separately. The resolver in
 * `resolve-base-oklch.ts` handles this two-level indirection for these entries.
 *
 * ## replaces field convention
 *
 * Each entry's `replaces` field matches the EXACT string the icon files emit:
 *   - a15: `oklch(from var(--${base}) l c h / 0.15)`
 *   - a30: `oklch(from var(--${base}) l c h / 0.3)`  ← one decimal, matches icon source
 *
 * @see resolve-base-oklch.ts — two-level resolver used to compute sRGB fallbacks.
 * @see packages/icons/src/domain/ — the 7 files that consume these tokens.
 * @see variant-tokens.ts — assembles VARIANT_TOKEN_MAP (appends DOMAIN_ALPHA_ENTRIES).
 * @see variant-token-schema.ts — VariantTokenEntry type.
 */

import type { VariantTokenEntry } from './variant-token-schema.js';

// ============================================================================
// Domain base name lists — sourced from @repo/design-tokens token files
// ============================================================================

/** 10 accommodation-type token base names. */
const ACCOMMODATION_TYPE_BASES = [
    'accommodation-type-hotel',
    'accommodation-type-apartment',
    'accommodation-type-house',
    'accommodation-type-country-house',
    'accommodation-type-cabin',
    'accommodation-type-camping',
    'accommodation-type-hostel',
    'accommodation-type-room',
    'accommodation-type-motel',
    'accommodation-type-resort'
] as const;

/** 12 amenity-type token base names. */
const AMENITY_TYPE_BASES = [
    'amenity-type-climate-control',
    'amenity-type-connectivity',
    'amenity-type-entertainment',
    'amenity-type-kitchen',
    'amenity-type-bed-and-bath',
    'amenity-type-outdoors',
    'amenity-type-accessibility',
    'amenity-type-services',
    'amenity-type-safety',
    'amenity-type-family-friendly',
    'amenity-type-work-friendly',
    'amenity-type-general-appliances'
] as const;

/** 5 auth-provider token base names. */
const AUTH_PROVIDER_BASES = [
    'auth-provider-local',
    'auth-provider-google',
    'auth-provider-facebook',
    'auth-provider-github',
    'auth-provider-better-auth'
] as const;

/** 8 event-category token base names. */
const EVENT_CATEGORY_BASES = [
    'event-category-culture',
    'event-category-sports',
    'event-category-festival',
    'event-category-workshop',
    'event-category-music',
    'event-category-gastronomy',
    'event-category-nature',
    'event-category-other'
] as const;

/** 18 post-category token base names. */
const POST_CATEGORY_BASES = [
    'post-category-events',
    'post-category-culture',
    'post-category-gastronomy',
    'post-category-nature',
    'post-category-tourism',
    'post-category-general',
    'post-category-sport',
    'post-category-carnival',
    'post-category-nightlife',
    'post-category-history',
    'post-category-traditions',
    'post-category-wellness',
    'post-category-family',
    'post-category-tips',
    'post-category-art',
    'post-category-beach',
    'post-category-rural',
    'post-category-festivals'
] as const;

/** 3 sponsor-type token base names. */
const SPONSOR_TYPE_BASES = [
    'sponsor-type-post-sponsor',
    'sponsor-type-advertiser',
    'sponsor-type-host'
] as const;

/** 7 user-role token base names. */
const USER_ROLE_BASES = [
    'user-role-super-admin',
    'user-role-admin',
    'user-role-editor',
    'user-role-host',
    'user-role-user',
    'user-role-guest',
    'user-role-system'
] as const;

// ============================================================================
// All 63 domain bases, in group order
// ============================================================================

const ALL_DOMAIN_BASES: ReadonlyArray<string> = [
    ...ACCOMMODATION_TYPE_BASES,
    ...AMENITY_TYPE_BASES,
    ...AUTH_PROVIDER_BASES,
    ...EVENT_CATEGORY_BASES,
    ...POST_CATEGORY_BASES,
    ...SPONSOR_TYPE_BASES,
    ...USER_ROLE_BASES
];

// ============================================================================
// Entry builder
// ============================================================================

/**
 * Build the two alpha-family entries (a15 + a30) for a single domain base.
 *
 * The `replaces` strings match EXACTLY what the icon domain files emit for
 * the `subtle` variant color scheme:
 *   - bg:     `oklch(from var(--${cssToken}) l c h / 0.15)`  → base-a15
 *   - border: `oklch(from var(--${cssToken}) l c h / 0.3)`   → base-a30
 *
 * @param base - Domain base token name (without `--`), e.g. `'accommodation-type-hotel'`.
 * @returns Two VariantTokenEntry objects: the a15 and a30 entries.
 */
function buildDomainAlphaEntries(base: string): [VariantTokenEntry, VariantTokenEntry] {
    return [
        {
            name: `${base}-a15`,
            base,
            family: 'alpha',
            param: 0.15,
            replaces: `oklch(from var(--${base}) l c h / 0.15)`
        },
        {
            name: `${base}-a30`,
            base,
            family: 'alpha',
            param: 0.3,
            replaces: `oklch(from var(--${base}) l c h / 0.3)`
        }
    ];
}

// ============================================================================
// DOMAIN_ALPHA_ENTRIES — 63 × 2 = 126 entries
// ============================================================================

/**
 * 126 alpha-family variant token entries for the 63 domain base tokens.
 *
 * Each domain base (accommodation-type-*, amenity-type-*, auth-provider-*,
 * event-category-*, post-category-*, sponsor-type-*, user-role-*) gets two
 * entries: `{base}-a15` (0.15 alpha, for badge `bg`) and `{base}-a30` (0.3
 * alpha, for badge `border`).
 *
 * The bases reference palette primitives via var() indirection (two levels).
 * `buildBaseOklchLookup` in `emit-variant-tokens.ts` (via `resolveBaseToOklch`)
 * handles this indirection.
 *
 * Order: accommodation-type (20) → amenity-type (24) → auth-provider (10) →
 * event-category (16) → post-category (36) → sponsor-type (6) → user-role (14).
 * Within each group: bases in declaration order from their token file, a15 before a30.
 *
 * @see resolve-base-oklch.ts — two-level resolver for the sRGB fallback computation.
 * @see packages/icons/src/domain/ — consumers that emit the `replaces` strings.
 */
export const DOMAIN_ALPHA_ENTRIES: ReadonlyArray<VariantTokenEntry> =
    ALL_DOMAIN_BASES.flatMap(buildDomainAlphaEntries);
