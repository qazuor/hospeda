/**
 * @file facet-config.ts
 * @description Per-facet multi-select quick-filter config model (HOS-96
 * T-001). This is the **product contract** ("The per-facet configuration
 * model" in `.specs/HOS-96-multi-select-quick-filter-chips/spec.md`): each
 * multi-selectable facet declares its own URL param keys, combination
 * operator, backing enum, and optional dedicated single-value landing,
 * instead of any part of the chip/sidebar/SEO code branching on a hardcoded
 * per-facet `if`. A sibling issue (e.g. gastronomía/experiencias, HOS-97) can
 * add a new facet by adding an entry here — no other module needs to change.
 *
 * Rules encoded (spec, "Rules the config must encode"):
 * 1. `operator` is `'AND' | 'OR'`. `'OR'` drives server-side `inArray`
 *    (SQL `IN (...)`) combination; `'AND'` is destinos-only, evaluated
 *    entirely client-side and never a backend concern.
 * 2. `paramKey` (plural, array) is the multi-select source of truth in the URL.
 * 3. `singularParamKey`, when present, is the pre-existing scalar param kept
 *    for backward compatibility (old links, dedicated landings). When both
 *    are present in a request, the array param takes precedence.
 *
 * This module is data only (no functions), so the RO-RO convention does not
 * apply. Every export is deeply frozen so the config cannot be mutated at
 * runtime — the values below are the single source of truth.
 */

import { AccommodationTypeEnum, EventCategoryEnum, PostCategoryEnum } from '@repo/schemas';

/**
 * Combination operator for a facet's active values.
 *
 * - `'OR'` — union (`inArray(column, values)`), resolved server-side.
 * - `'AND'` — intersection, resolved entirely client-side today (destinos
 *   only); not a backend concern.
 */
export type FacetOperator = 'AND' | 'OR';

/** Stable identifier for each multi-selectable quick-filter facet. */
export type FacetId =
    | 'accommodationType'
    | 'eventCategory'
    | 'postCategory'
    | 'destinationAttraction'
    | 'pointOfInterestCategory';

/**
 * Declared config for one multi-selectable quick-filter facet.
 */
export interface FacetConfig {
    /** Stable identifier for this facet (lookup key in {@link FACET_CONFIG_BY_ID}). */
    readonly id: FacetId;
    /** Plural array query param — the multi-select source of truth in the URL (e.g. `'types'`). */
    readonly paramKey: string;
    /**
     * Pre-existing scalar query param kept for backward compatibility (e.g.
     * `'type'`), or `undefined` when the facet never had one (destinos).
     * When both `paramKey` and `singularParamKey` are present on a request,
     * the array param wins.
     */
    readonly singularParamKey: string | undefined;
    /** How 2+ active values combine. See {@link FacetOperator}. */
    readonly operator: FacetOperator;
    /**
     * The backing enum object for this facet's values (e.g.
     * `AccommodationTypeEnum`), used to validate/derive the Zod schema and to
     * enumerate every possible chip. `undefined` when the facet's values are
     * not a closed enum — the destination-attraction facet's values are
     * DB-generated attraction ids (UUID strings), not a static enum, so it is
     * `undefined` here and documented rather than represented with a fake enum.
     */
    readonly enum: Readonly<Record<string, string>> | undefined;
    /**
     * URL pattern (with a `{slug}` placeholder) of the dedicated single-value
     * landing that stays canonical for exactly one active value (US-6), or
     * `undefined` when the facet has no dedicated landing.
     */
    readonly dedicatedLandingPattern: string | undefined;
    /**
     * `true` when this facet is resolved entirely client-side and is NOT a
     * backend/API concern (destinos, US-12) — every other facet is `false`.
     */
    readonly outOfBackendScope: boolean;
}

/**
 * Per-facet config keyed by {@link FacetId}. The single source of truth for
 * every multi-selectable quick-filter facet's URL params, operator, and
 * dedicated-landing behavior.
 *
 * @example
 * ```ts
 * const { paramKey, operator } = FACET_CONFIG_BY_ID.accommodationType;
 * // paramKey === 'types', operator === 'OR'
 * ```
 */
export const FACET_CONFIG_BY_ID: Readonly<Record<FacetId, FacetConfig>> = Object.freeze({
    accommodationType: Object.freeze({
        id: 'accommodationType',
        paramKey: 'types',
        singularParamKey: 'type',
        operator: 'OR',
        enum: AccommodationTypeEnum,
        dedicatedLandingPattern: '/alojamientos/tipo/{slug}/',
        outOfBackendScope: false
    }),
    eventCategory: Object.freeze({
        id: 'eventCategory',
        paramKey: 'categories',
        singularParamKey: 'category',
        operator: 'OR',
        enum: EventCategoryEnum,
        // Owner decision (HOS-96 T-017/18/19 integration review, 2026-07-xx):
        // events KEEPS its dedicated `/eventos/categoria/{slug}/` landing as
        // the 1-value canonical. SPEC-306 already built that landing, and
        // `/eventos/?category=X` already canonicalized to it before this
        // spec — this PRESERVES that behavior, it does not introduce it. The
        // spec's original "per-facet configuration model" table wrongly
        // stated events had no dedicated landing; that was a documentation
        // error, not a product decision to regress SPEC-306. Slug transform
        // (`value.toLowerCase().replace(/_/g, '-')`, applied by
        // `resolveFacetSeoDecision`) was verified to match every
        // `EventCategoryEnum` member against the landing route's own
        // `VALID_CATEGORIES` slug dictionary (no enum member contains `_`,
        // so both are simple lowercasing — e.g. `MUSIC` -> `music`).
        // HOS-96 pre-merge review follow-up: T-018's `activeCategories`
        // switch to the PLURAL `categories` param briefly broke this
        // preservation claim for legacy SINGULAR-only links (`?category=X`
        // resolved zero active values, losing this canonical) — fixed by
        // `readFacetActiveValues`'s optional `singularParamKey` fallback
        // (Option A, owner-approved), consulted by every page via
        // `singularParamKey` below. The "PRESERVES that behavior" claim
        // above is accurate again end-to-end (single AND plural URLs both
        // covered), not just in isolation.
        dedicatedLandingPattern: '/eventos/categoria/{slug}/',
        outOfBackendScope: false
    }),
    postCategory: Object.freeze({
        id: 'postCategory',
        paramKey: 'categories',
        singularParamKey: 'category',
        operator: 'OR',
        enum: PostCategoryEnum,
        dedicatedLandingPattern: '/publicaciones/categoria/{slug}/',
        outOfBackendScope: false
    }),
    destinationAttraction: Object.freeze({
        id: 'destinationAttraction',
        paramKey: 'attractions',
        singularParamKey: undefined,
        operator: 'AND',
        enum: undefined,
        dedicatedLandingPattern: undefined,
        outOfBackendScope: true
    }),
    // HOS-147: thematic POI-category filter on the destination detail page.
    // DB-driven values (category slugs from the public poi-categories catalog),
    // so `enum` is `undefined` like `destinationAttraction`. `operator: 'OR'`
    // (any-of union) per spec D-1. `outOfBackendScope: true` (like destinos):
    // owner decision D-3 resolves this filter ENTIRELY client-side over the
    // already-loaded, unpaginated POI list — the URL `?categories=` param is
    // for shareability only, never a server round-trip. No dedicated landing
    // (NG-4): the destination page stays canonical, the filter is a client-side
    // view refinement.
    pointOfInterestCategory: Object.freeze({
        id: 'pointOfInterestCategory',
        paramKey: 'categories',
        singularParamKey: undefined,
        operator: 'OR',
        enum: undefined,
        dedicatedLandingPattern: undefined,
        outOfBackendScope: true
    })
});

/**
 * Every declared facet config, as a flat readonly array — convenient for
 * iteration (e.g. rendering every chip row's config) without needing to know
 * every {@link FacetId} up front.
 */
export const FACET_CONFIGS: readonly FacetConfig[] = Object.freeze(
    Object.values(FACET_CONFIG_BY_ID)
);
