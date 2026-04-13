/**
 * Legacy filter format adapter for the accommodation listing summary builder.
 *
 * Converts the flat `LegacyFilter[]` format (used by older filter UI components)
 * into the typed `AccommodationSummaryFilters` shape expected by the summary builder.
 *
 * The mapping is tolerant: unknown keys are silently skipped and malformed
 * values are ignored rather than throwing.
 */

import { cleanText } from './summary.helpers';
import type { AccommodationSummaryFilters } from './summary.types';

// ---------------------------------------------------------------------------
// Legacy types
// ---------------------------------------------------------------------------

/**
 * Filter entry in the legacy flat-array format used by older UI components.
 */
export interface LegacyFilter {
    /** UI control type that produced this filter. */
    readonly type:
        | 'checkbox'
        | 'text'
        | 'range'
        | 'dual-range'
        | 'stepper'
        | 'stars'
        | 'toggle'
        | 'select-search'
        | 'icon-chips';
    /** Field key the filter applies to. */
    readonly key: string;
    /** Selected values. May contain strings, numbers, booleans, null, or undefined. */
    readonly values: readonly (string | number | boolean | null | undefined)[];
}

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/** Input for {@link mapLegacyFiltersToSummaryFilters}. */
export interface MapLegacyFiltersInput {
    /** Array of legacy filter entries to convert. */
    readonly filters: readonly LegacyFilter[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts an array of non-empty string values from a values array.
 * @internal
 */
function toStringArray(
    values: readonly (string | number | boolean | null | undefined)[]
): string[] {
    return values.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/**
 * Extracts the first value as a string, returning null for empty/null/undefined.
 * @internal
 */
function firstAsString(
    values: readonly (string | number | boolean | null | undefined)[]
): string | null {
    const v = values[0];
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
}

/**
 * Extracts the first value as a number or string for numeric fields.
 * Returns null for empty/null/undefined/non-numeric values.
 * @internal
 */
function firstAsNumberOrString(
    values: readonly (string | number | boolean | null | undefined)[]
): number | string | null {
    const v = values[0];
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim().length > 0) return v;
    return null;
}

/**
 * Extracts the first value as a boolean. Returns null for non-boolean values.
 * @internal
 */
function firstAsBoolean(
    values: readonly (string | number | boolean | null | undefined)[]
): boolean | null {
    const v = values[0];
    if (typeof v === 'boolean') return v;
    return null;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Converts legacy flat-array filter format to the typed `AccommodationSummaryFilters`
 * shape expected by `buildAccommodationListingSummary`.
 *
 * ### Mapping rules
 *
 * | Legacy key | Mapped to |
 * |------------|-----------|
 * | `accommodationType`, `types` | `types` |
 * | `destination`, `destinationIds` | `destinations` |
 * | `name`, `q` (type=text) | `text` |
 * | `price` (type=range or dual-range) | `price.min`, `price.max`, `price.includeWithoutPrice` |
 * | `minGuests` (type=stepper) | `guests` |
 * | `minBedrooms` (type=stepper) | `bedrooms` |
 * | `minBathrooms` (type=stepper) | `bathrooms` |
 * | `minRating` (type=stars) | `minRating`, `includeWithoutRating` |
 * | `amenities` (type=icon-chips or checkbox) | `amenities` |
 * | `features` (type=icon-chips or checkbox) | `services` |
 * | `isFeatured` (type=toggle) | `featured` |
 *
 * Unknown keys are silently skipped. Malformed values are ignored.
 *
 * @param input - {@link MapLegacyFiltersInput}
 * @returns Typed `AccommodationSummaryFilters` object
 *
 * @example
 * ```ts
 * mapLegacyFiltersToSummaryFilters({
 *   filters: [
 *     { type: 'checkbox', key: 'types', values: ['HOTEL', 'CABIN'] },
 *     { type: 'range', key: 'price', values: [5000, 20000, false] },
 *     { type: 'stepper', key: 'minGuests', values: [3] },
 *   ]
 * })
 * // => { types: ['HOTEL', 'CABIN'], price: { min: 5000, max: 20000, includeWithoutPrice: false }, guests: 3 }
 * ```
 */
export function mapLegacyFiltersToSummaryFilters({
    filters
}: MapLegacyFiltersInput): AccommodationSummaryFilters {
    let types: string[] | undefined;
    let text: string | null | undefined;
    let priceMin: number | string | null | undefined;
    let priceMax: number | string | null | undefined;
    let priceIncludeWithout: boolean | null | undefined;
    let destinations: string[] | undefined;
    let guests: number | string | null | undefined;
    let bedrooms: number | string | null | undefined;
    let bathrooms: number | string | null | undefined;
    let services: string[] | undefined;
    let amenities: string[] | undefined;
    let minRating: number | string | null | undefined;
    let includeWithoutRating: boolean | null | undefined;
    let featured: boolean | null | undefined;

    for (const filter of filters) {
        const { key, values, type } = filter;

        switch (key) {
            case 'accommodationType':
            case 'types': {
                const arr = toStringArray(values);
                if (arr.length > 0) types = arr;
                break;
            }

            case 'destination':
            case 'destinationIds': {
                const arr = toStringArray(values);
                if (arr.length > 0) destinations = arr;
                break;
            }

            case 'name':
            case 'q': {
                if (type === 'text') {
                    const raw = firstAsString(values);
                    if (raw !== null) {
                        text = cleanText({ text: raw });
                    }
                }
                break;
            }

            case 'price': {
                if (type === 'range' || type === 'dual-range') {
                    priceMin = firstAsNumberOrString(values);
                    const v1 = values[1];
                    priceMax =
                        v1 !== null && v1 !== undefined
                            ? typeof v1 === 'number' || typeof v1 === 'string'
                                ? v1
                                : null
                            : null;
                    const v2 = values[2];
                    priceIncludeWithout = typeof v2 === 'boolean' ? v2 : null;
                }
                break;
            }

            case 'minGuests': {
                if (type === 'stepper') {
                    guests = firstAsNumberOrString(values);
                }
                break;
            }

            case 'minBedrooms': {
                if (type === 'stepper') {
                    bedrooms = firstAsNumberOrString(values);
                }
                break;
            }

            case 'minBathrooms': {
                if (type === 'stepper') {
                    bathrooms = firstAsNumberOrString(values);
                }
                break;
            }

            case 'minRating': {
                if (type === 'stars') {
                    minRating = firstAsNumberOrString(values);
                    const v1 = values[1];
                    includeWithoutRating = typeof v1 === 'boolean' ? v1 : null;
                }
                break;
            }

            case 'amenities': {
                if (type === 'icon-chips' || type === 'checkbox') {
                    const arr = toStringArray(values);
                    if (arr.length > 0) amenities = arr;
                }
                break;
            }

            case 'features': {
                if (type === 'icon-chips' || type === 'checkbox') {
                    const arr = toStringArray(values);
                    if (arr.length > 0) services = arr;
                }
                break;
            }

            case 'isFeatured': {
                if (type === 'toggle') {
                    featured = firstAsBoolean(values);
                }
                break;
            }

            default:
                // Unknown key — silently skip
                break;
        }
    }

    // Build the result only with fields that have actual values
    const result: AccommodationSummaryFilters = {
        ...(types !== undefined && { types }),
        ...(text !== undefined && text !== null && { text }),
        ...(destinations !== undefined && { destinations }),
        ...(guests !== undefined && guests !== null && { guests }),
        ...(bedrooms !== undefined && bedrooms !== null && { bedrooms }),
        ...(bathrooms !== undefined && bathrooms !== null && { bathrooms }),
        ...(services !== undefined && { services }),
        ...(amenities !== undefined && { amenities }),
        ...(minRating !== undefined && minRating !== null && { minRating }),
        ...(includeWithoutRating !== undefined &&
            includeWithoutRating !== null && {
                includeWithoutRating
            }),
        ...(featured !== undefined && featured !== null && { featured }),
        ...((priceMin !== undefined && priceMin !== null) ||
        (priceMax !== undefined && priceMax !== null) ||
        priceIncludeWithout === true
            ? {
                  price: {
                      ...(priceMin !== undefined && priceMin !== null && { min: priceMin }),
                      ...(priceMax !== undefined && priceMax !== null && { max: priceMax }),
                      ...(priceIncludeWithout !== undefined &&
                          priceIncludeWithout !== null && {
                              includeWithoutPrice: priceIncludeWithout
                          })
                  }
              }
            : {})
    };

    return result;
}
