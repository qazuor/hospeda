/**
 * @file tourist-attraction-jsonld.ts
 * @description Pure builder for the experience detail page's schema.org
 * structured data (SPEC-268 F2/F3, enriched by HOS-2579 §6.6).
 *
 * Every optional property is emitted only when the data for it exists:
 * - `geo` from the meeting-point coordinates. They ride the public payload on
 *   every tier (HOS-1048); the paid part is the map widget, not the numbers.
 * - `aggregateRating` when the review count is above 0.
 * - `isAccessibleForFree: false` when there is a positive price.
 * - `containedInPlace` (`City`) from the destination name.
 * - `offers` (`Offer`, ARS) from the price, never when the price is on request.
 *
 * schema.org `TouristAttraction` is a `Place` and has no `offers` property, so
 * an object that carries a price is multi-typed `['TouristAttraction',
 * 'TouristTrip']` (`TouristTrip` → `Trip` has `offers`). This is owner decision
 * D-2. Without a price the object stays a plain `TouristAttraction`, because a
 * `TouristTrip` type would add nothing.
 */

/** Currency every Hospeda price is stored in. */
const PRICE_CURRENCY = 'ARS';

/** Inputs the experience detail page already has. */
export interface TouristAttractionJsonLdInput {
    /** Experience name. */
    readonly name: string;
    /** Canonical URL of the detail page. */
    readonly url: string;
    /** SEO description. Omitted when empty. */
    readonly description?: string;
    /** Featured image URL. Omitted when empty. */
    readonly image?: string;
    /** Public telephone. Omitted when empty. */
    readonly telephone?: string;
    /** Meeting-point latitude, or `null` when the spot is not pinned. */
    readonly latitude?: number | null;
    /** Meeting-point longitude, or `null` when the spot is not pinned. */
    readonly longitude?: number | null;
    /** Average review rating (0–5). */
    readonly ratingValue?: number;
    /** Number of reviews behind {@link ratingValue}. */
    readonly reviewCount?: number;
    /** Base price in centavos, or `null` when there is none. */
    readonly priceFrom?: number | null;
    /** Whether the price is on request (no price is published). */
    readonly isPriceOnRequest?: boolean;
    /** Name of the destination (city) the experience belongs to. */
    readonly destinationName?: string;
}

/** Result of {@link buildTouristAttractionJsonLd}. */
export interface TouristAttractionJsonLdResult {
    /** The structured data object, ready for `JsonLd.astro`. */
    readonly data: Record<string, unknown>;
}

function isFiniteNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Builds the experience's schema.org object.
 *
 * @param input - {@link TouristAttractionJsonLdInput}
 * @returns `{ data }`, the structured data object.
 *
 * @example
 * ```ts
 * const { data } = buildTouristAttractionJsonLd({
 *     name: 'Kayak al atardecer',
 *     url: 'https://hospeda.com.ar/es/experiencias/kayak/',
 *     priceFrom: 850000
 * });
 * // data.offers → { '@type': 'Offer', price: 8500, priceCurrency: 'ARS' }
 * ```
 */
export function buildTouristAttractionJsonLd(
    input: TouristAttractionJsonLdInput
): TouristAttractionJsonLdResult {
    const {
        name,
        url,
        description,
        image,
        telephone,
        latitude,
        longitude,
        ratingValue,
        reviewCount,
        priceFrom,
        isPriceOnRequest = false,
        destinationName
    } = input;

    const hasPrice = !isPriceOnRequest && isFiniteNumber(priceFrom) && priceFrom > 0;
    const hasGeo = isFiniteNumber(latitude) && isFiniteNumber(longitude);
    const hasRating = isFiniteNumber(reviewCount) && reviewCount > 0 && isFiniteNumber(ratingValue);
    const city = destinationName?.trim();

    const data: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': hasPrice ? ['TouristAttraction', 'TouristTrip'] : 'TouristAttraction',
        name,
        url,
        ...(description ? { description } : {}),
        ...(image ? { image } : {}),
        ...(telephone ? { telephone } : {}),
        ...(hasGeo ? { geo: { '@type': 'GeoCoordinates', latitude, longitude } } : {}),
        ...(hasRating
            ? { aggregateRating: { '@type': 'AggregateRating', ratingValue, reviewCount } }
            : {}),
        ...(city ? { containedInPlace: { '@type': 'City', name: city } } : {}),
        ...(hasPrice
            ? {
                  isAccessibleForFree: false,
                  offers: {
                      '@type': 'Offer',
                      price: priceFrom / 100,
                      priceCurrency: PRICE_CURRENCY
                  }
              }
            : {})
    };

    return { data };
}
