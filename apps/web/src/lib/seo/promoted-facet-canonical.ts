/**
 * Single-facet canonical resolution (SPEC-306 OQ-3).
 *
 * A facet promoted to a first-class landing (event category, accommodation
 * type) should have its main-listing query-param form (`?category=music`,
 * `?types=HOTEL`) canonicalize to that landing's path — but ONLY when the
 * promoted facet is the sole active filter. Any additional filter active
 * alongside it falls back to the base-listing canonical (OQ-3's
 * "combinations canonicalize to base" rule), since a combination is not the
 * single indexable concept the landing represents.
 */

/**
 * Pure helper: decide whether the active facet values resolve to a single
 * promoted-landing slug, or should fall back to the base listing.
 *
 * @param facetValues - Active values for the promoted facet from the current
 *   URL (e.g. `['HOTEL']`, or `[]` when absent). More than one value means
 *   the user combined multiple values of the SAME facet (e.g. two types),
 *   which also falls back to the base listing — a landing represents one
 *   value, not a union.
 * @param hasOtherFilters - Whether any OTHER (non-promoted-facet) filter is
 *   also active (search, destination, price, amenities, dates, etc.).
 * @param validEnumValues - The facet's canonical enum values, used to reject
 *   an unrecognized/malformed value rather than build a link to a 404.
 * @returns The single promoted value to canonicalize to, or `undefined` when
 *   the base-listing canonical should be used instead.
 */
export function resolvePromotedFacetCanonical({
    facetValues,
    hasOtherFilters,
    validEnumValues
}: {
    readonly facetValues: readonly string[];
    readonly hasOtherFilters: boolean;
    readonly validEnumValues: readonly string[];
}): string | undefined {
    if (facetValues.length !== 1 || hasOtherFilters) {
        return undefined;
    }
    const [value] = facetValues;
    return value !== undefined && validEnumValues.includes(value) ? value : undefined;
}

/**
 * Shared 2+-value SEO predicate (HOS-96 US-6/US-7, OQ-1 resolved).
 *
 * The single helper every affected listing (`alojamientos/`, `eventos/`,
 * `publicaciones/`) must consume to decide `noindex`/canonical for a
 * multi-select facet's active values — no per-page divergence (spec US-7's
 * closing acceptance criterion). It builds on
 * {@link resolvePromotedFacetCanonical} for the single-value validation (enum
 * membership + "no other filter active") instead of re-implementing it.
 */

/**
 * What a page should render as its `<link rel="canonical">` target, once the
 * `noindex` decision below has been made. A page resolves this into an actual
 * href using its own `dedicatedLandingPattern`/`buildUrl` plumbing — this
 * predicate only decides WHICH kind of canonical applies and, for the
 * dedicated-landing case, the slug segment to substitute into the facet's
 * `dedicatedLandingPattern`.
 */
export type FacetSeoCanonical =
    | { readonly kind: 'base' }
    | {
          readonly kind: 'dedicatedLanding';
          /**
           * Landing-page slug segment derived from the single active facet
           * value (e.g. `'COUNTRY_HOUSE'` -> `'country-house'`), ready to
           * substitute into the facet's `dedicatedLandingPattern`
           * `{slug}` placeholder.
           */
          readonly slug: string;
      };

/** Result of {@link resolveFacetSeoDecision}. */
export interface FacetSeoDecision {
    /**
     * `true` when the page must emit `<meta name="robots" content="noindex,
     * follow">` (2+ active facet values — US-7). `false` for 0 or exactly 1
     * value.
     */
    readonly noindex: boolean;
    /** Which canonical target the page should render. See {@link FacetSeoCanonical}. */
    readonly canonical: FacetSeoCanonical;
}

/** `{ noindex: false, canonical: { kind: 'base' } }` — the fallback/default decision. */
const BASE_LISTING_DECISION: FacetSeoDecision = {
    noindex: false,
    canonical: { kind: 'base' }
};

/**
 * Decide the `noindex`/canonical outcome for one multi-select facet's active
 * values (HOS-96 US-6/US-7, OQ-1 resolved):
 *
 * - 0 active values, or another (non-facet) filter also active -> indexable,
 *   base-listing canonical.
 * - exactly 1 valid active value, no other filter -> indexable; canonical is
 *   the facet's dedicated landing when `dedicatedLandingPattern` is defined,
 *   else the base listing (events have no dedicated landing today).
 * - 2 or more active values -> `noindex,follow` + base-listing canonical
 *   (strips facet params). 3+ behaves identically to 2 — there is no special
 *   "many values" case.
 *
 * @param facetValues - Active values for this facet from the current URL.
 * @param hasOtherFilters - Whether any OTHER (non-facet) filter is also
 *   active (search, destination, price, dates, etc.).
 * @param validEnumValues - The facet's canonical enum values (rejects an
 *   unrecognized/malformed single value rather than link to a 404).
 * @param dedicatedLandingPattern - The facet's dedicated single-value landing
 *   URL pattern (e.g. `/alojamientos/tipo/{slug}/`), or `undefined` when the
 *   facet has none (see {@link FACET_CONFIG_BY_ID} in `facet-config.ts`).
 * @returns The `noindex`/canonical decision. See {@link FacetSeoDecision}.
 */
export function resolveFacetSeoDecision({
    facetValues,
    hasOtherFilters,
    validEnumValues,
    dedicatedLandingPattern
}: {
    readonly facetValues: readonly string[];
    readonly hasOtherFilters: boolean;
    readonly validEnumValues: readonly string[];
    readonly dedicatedLandingPattern: string | undefined;
}): FacetSeoDecision {
    if (facetValues.length >= 2) {
        return { noindex: true, canonical: { kind: 'base' } };
    }

    const promotedValue = resolvePromotedFacetCanonical({
        facetValues,
        hasOtherFilters,
        validEnumValues
    });

    if (promotedValue === undefined || dedicatedLandingPattern === undefined) {
        return BASE_LISTING_DECISION;
    }

    return {
        noindex: false,
        canonical: {
            kind: 'dedicatedLanding',
            slug: promotedValue.toLowerCase().replace(/_/g, '-')
        }
    };
}
