/**
 * @file accommodation-card.utils.ts
 * @description Shared utility functions and types for accommodation card components.
 * Used by AccommodationCardFeatured.astro and AccommodationCardDetailed.astro.
 */

/**
 * Shared interface for accommodation card location data.
 */
export interface CardLocationData {
    readonly city?: string;
    readonly state?: string;
}

/**
 * Shared interface for accommodation card price data.
 */
export interface CardPriceData {
    readonly amount: number;
    readonly currency: string;
    readonly period?: string;
}

/**
 * Maps an accommodation type enum value (UPPERCASE) to its i18n key (lowercase).
 *
 * The database stores types as HOTEL, CABIN, etc. but i18n keys use lowercase
 * (e.g., `types.hotel`, `types.cabin`). This function performs that mapping.
 *
 * @param params - Object containing the accommodation type string
 * @param params.type - Accommodation type in uppercase (e.g., "HOTEL", "CABIN")
 * @returns The dot-separated i18n key string (e.g., "types.hotel")
 *
 * @example
 * getTypeI18nKey({ type: 'HOTEL' }) // => 'types.hotel'
 * getTypeI18nKey({ type: 'COUNTRY_HOUSE' }) // => 'types.country_house'
 */
export function getTypeI18nKey({ type }: { readonly type: string }): string {
    return `types.${type.toLowerCase()}`;
}

/**
 * Formats location data into a human-readable display string.
 *
 * Returns "City, State" when both are present, or just the available value
 * when only one is defined. Returns an empty string when neither is present.
 *
 * @param params - Object containing optional city and state strings
 * @param params.city - Optional city name
 * @param params.state - Optional state name
 * @returns Formatted location string (e.g., "Concepcion del Uruguay, Entre Rios")
 *
 * @example
 * formatLocationDisplay({ city: 'Concordia', state: 'Entre Rios' }) // => 'Concordia, Entre Rios'
 * formatLocationDisplay({ city: 'Concordia' }) // => 'Concordia'
 * formatLocationDisplay({}) // => ''
 */
export function formatLocationDisplay({ city, state }: CardLocationData): string {
    const c = city ?? '';
    const s = state ?? '';
    return c && s ? `${c}, ${s}` : c || s;
}

/**
 * Result type returned by {@link formatRating}.
 */
export interface FormatRatingResult {
    readonly numericRating: number;
    readonly formattedRating: string;
}

/**
 * Formats a numeric rating value to one decimal place.
 *
 * Coerces the input to a number, defaulting to 0 for undefined or non-numeric
 * values. Returns both the raw numeric value and the formatted string.
 *
 * @param params - Object containing the optional average rating
 * @param params.averageRating - The raw rating value (may be undefined or NaN)
 * @returns Object with `numericRating` (number) and `formattedRating` (string)
 *
 * @example
 * formatRating({ averageRating: 4.567 }) // => { numericRating: 4.567, formattedRating: '4.6' }
 * formatRating({ averageRating: undefined }) // => { numericRating: 0, formattedRating: '0.0' }
 */
export function formatRating({
    averageRating
}: {
    readonly averageRating: number | undefined;
}): FormatRatingResult {
    const numericRating = Number(averageRating) || 0;
    return { numericRating, formattedRating: numericRating.toFixed(1) };
}

/**
 * Formats a price object into a display string using Argentine locale formatting.
 *
 * Returns `undefined` when no price or amount is provided, allowing callers
 * to fall back to a "consult price" i18n key.
 *
 * @param params - Object containing optional price data
 * @param params.price - Optional price data with amount, currency, and period
 * @returns Formatted price string (e.g., "$12.500") or `undefined`
 *
 * @example
 * formatPrice({ price: { amount: 12500, currency: 'ARS' } }) // => '$12.500'
 * formatPrice({ price: undefined }) // => undefined
 * formatPrice({ price: { amount: 0, currency: 'ARS' } }) // => undefined
 */
export function formatPrice({
    price
}: {
    readonly price: CardPriceData | undefined;
}): string | undefined {
    return price?.amount ? `$${price.amount.toLocaleString('es-AR')}` : undefined;
}

/**
 * Builds the canonical detail page URL for an accommodation.
 *
 * @param params - Object containing locale and slug
 * @param params.locale - The current locale string (e.g., 'es', 'en', 'pt')
 * @param params.slug - The accommodation's URL slug
 * @returns Absolute path string (e.g., "/es/alojamientos/hotel-ejemplo/")
 *
 * @example
 * buildDetailUrl({ locale: 'es', slug: 'hotel-ejemplo' })
 * // => '/es/alojamientos/hotel-ejemplo/'
 */
export function buildDetailUrl({
    locale,
    slug
}: {
    readonly locale: string;
    readonly slug: string;
}): string {
    return `/${locale}/alojamientos/${slug}/`;
}
