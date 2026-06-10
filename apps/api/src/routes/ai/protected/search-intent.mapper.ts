/**
 * Search-intent → AccommodationSearchHttp mapper (SPEC-199 T-002).
 *
 * A pure function with zero DB calls, zero AI calls, and zero side effects.
 * Translates validated {@link SearchIntentEntities} slots to a flat
 * `Record<string, string | string[]>` that is URL-ready (no further
 * serialisation needed by callers).
 *
 * ## Responsibilities
 *
 * - **Whitelist enforcement**: only writes keys that exist in
 *   {@link AccommodationSearchHttpSchema}. Any slot not in the mapping table
 *   is silently dropped (R-1 hallucination defence).
 * - **Location priority** (exclusive): `destinationId` wins over geo, which
 *   wins over `city`. At most one location strategy is emitted.
 * - **Conflict / clamp rules**: guests, price, rating, and date conflicts are
 *   resolved by dropping or clamping per §5.3 of SPEC-199.
 * - **Boolean serialisation**: `hasPool`, `hasWifi`, `allowsPets`, and
 *   `hasParking` are emitted as the string `'true'` to match the
 *   `createBooleanQueryParam` contract used by `AccommodationSearchHttpSchema`.
 * - **Internal-hint keys dropped**: `locationType`, `amenitySlugs`, and
 *   `featureSlugs` are never forwarded as query params.
 *
 * @module apps/api/routes/ai/protected/search-intent.mapper
 */

import type { SearchIntentEntities } from '@repo/schemas';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum allowed search radius in km (§5.3 clamp rule). */
const MAX_RADIUS_KM = 500;

/** Minimum rating boundary. */
const MIN_RATING = 0;

/** Maximum rating boundary. */
const MAX_RATING = 5;

// ─── Helper types ─────────────────────────────────────────────────────────────

/**
 * URL-ready output type.
 *
 * Keys must be valid {@link AccommodationSearchHttp} keys.
 * Values are strings or string arrays (no native booleans or numbers).
 */
type MappedParams = Record<string, string | string[]>;

// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * Converts a `Date` to an ISO date string in `YYYY-MM-DD` format.
 *
 * `toISOString()` always yields `YYYY-MM-DDTHH:mm:ss.sssZ`, so the first 10
 * characters are the date part — no split or non-null assertion needed.
 */
function toIsoDateString(date: Date): string {
    return date.toISOString().substring(0, 10);
}

// ─── Pure mapper ─────────────────────────────────────────────────────────────

/**
 * Maps validated {@link SearchIntentEntities} to `AccommodationSearchHttp`
 * query params, URL-serialised and ready to append to a `URLSearchParams` instance.
 *
 * Rules applied (§5.3):
 * - Location priority (exclusive): `destinationId` > geo (`lat`+`lng`) > `city` as `q`.
 * - `radius` is only emitted when both `latitude` and `longitude` are present.
 *   Clamped to {@link MAX_RADIUS_KM} km.
 * - Guests: if `minGuests > maxGuests`, `maxGuests` is dropped.
 * - Bedrooms: if `minBedrooms > maxBedrooms`, `maxBedrooms` is dropped.
 * - Bathrooms: if `minBathrooms > maxBathrooms`, `maxBathrooms` is dropped.
 * - Price: if `minPrice > maxPrice` (both present), both are dropped.
 * - Currency: only emitted when at least one price param was emitted.
 * - Rating: clamped to [0, 5]. If after clamping `minRating > maxRating`, `maxRating` is dropped.
 * - Booleans (`hasPool`, `hasWifi`, `allowsPets`, `hasParking`): emitted as the
 *   **string** `'true'` — never as a native boolean.
 * - Amenities: forwarded from `resolvedAmenityIds` only when non-empty.
 * - Features: forwarded from `resolvedFeatureIds` only when non-empty.
 * - Dates: `checkIn` / `checkOut` emitted as ISO date string (`YYYY-MM-DD`).
 *   If `checkOut <= checkIn`, both are dropped.
 * - Internal hints (`locationType`, `amenitySlugs`, `featureSlugs`) are never emitted.
 *
 * @param entities - Validated {@link SearchIntentEntities} (all fields optional).
 * @param resolvedAmenityIds - UUID strings resolved from `entities.amenitySlugs`
 *   by the route handler (§5.4). Empty array → field omitted.
 * @param resolvedFeatureIds - UUID strings resolved from `entities.featureSlugs`
 *   by the route handler (§5.4). Empty array → field omitted.
 * @returns URL-ready params — pass directly to `URLSearchParams` without
 *   further conversion.
 */
export function mapIntentToSearchParams(
    entities: SearchIntentEntities,
    resolvedAmenityIds: readonly string[] = [],
    resolvedFeatureIds: readonly string[] = []
): MappedParams {
    const params: MappedParams = {};

    // ── Location (exclusive, priority order) ─────────────────────────────────
    if (entities.destinationId !== undefined) {
        // Priority 1: known destination UUID — wins over all other location strategies.
        params.destinationId = entities.destinationId;
    } else if (entities.latitude !== undefined && entities.longitude !== undefined) {
        // Priority 2: geo coords. Both lat + lng must be present together.
        params.latitude = String(entities.latitude);
        params.longitude = String(entities.longitude);

        if (entities.radius !== undefined) {
            // Clamp radius to MAX_RADIUS_KM; only emit when lat+lng present.
            const clampedRadius = Math.min(entities.radius, MAX_RADIUS_KM);
            params.radius = String(clampedRadius);
        }
    } else if (entities.city !== undefined) {
        // Priority 3: city name as keyword search fallback.
        params.q = entities.city;
    }

    // ── Accommodation type ────────────────────────────────────────────────────
    if (entities.accommodationType !== undefined) {
        params.type = entities.accommodationType;
    }

    // ── Guest capacity ────────────────────────────────────────────────────────
    if (entities.minGuests !== undefined || entities.maxGuests !== undefined) {
        const min = entities.minGuests;
        const max = entities.maxGuests;

        if (min !== undefined && max !== undefined) {
            // Both present: drop maxGuests if it's less than minGuests.
            params.minGuests = String(min);
            if (max >= min) {
                params.maxGuests = String(max);
            }
        } else if (min !== undefined) {
            params.minGuests = String(min);
        } else if (max !== undefined) {
            params.maxGuests = String(max);
        }
    }

    // ── Bedroom count ─────────────────────────────────────────────────────────
    if (entities.minBedrooms !== undefined || entities.maxBedrooms !== undefined) {
        const min = entities.minBedrooms;
        const max = entities.maxBedrooms;

        if (min !== undefined && max !== undefined) {
            params.minBedrooms = String(min);
            if (max >= min) {
                params.maxBedrooms = String(max);
            }
        } else if (min !== undefined) {
            params.minBedrooms = String(min);
        } else if (max !== undefined) {
            params.maxBedrooms = String(max);
        }
    }

    // ── Bathroom count ────────────────────────────────────────────────────────
    if (entities.minBathrooms !== undefined || entities.maxBathrooms !== undefined) {
        const min = entities.minBathrooms;
        const max = entities.maxBathrooms;

        if (min !== undefined && max !== undefined) {
            params.minBathrooms = String(min);
            if (max >= min) {
                params.maxBathrooms = String(max);
            }
        } else if (min !== undefined) {
            params.minBathrooms = String(min);
        } else if (max !== undefined) {
            params.maxBathrooms = String(max);
        }
    }

    // ── Price ─────────────────────────────────────────────────────────────────
    // If both present and minPrice > maxPrice, drop BOTH (conflicting range).
    let priceEmitted = false;

    if (entities.minPrice !== undefined && entities.maxPrice !== undefined) {
        if (entities.minPrice <= entities.maxPrice) {
            params.minPrice = String(entities.minPrice);
            params.maxPrice = String(entities.maxPrice);
            priceEmitted = true;
        }
        // If minPrice > maxPrice: drop both — no-op.
    } else if (entities.minPrice !== undefined) {
        params.minPrice = String(entities.minPrice);
        priceEmitted = true;
    } else if (entities.maxPrice !== undefined) {
        params.maxPrice = String(entities.maxPrice);
        priceEmitted = true;
    }

    // Currency: only emit when at least one price param was emitted.
    if (priceEmitted && entities.currency !== undefined) {
        params.currency = entities.currency;
    }

    // ── Rating ────────────────────────────────────────────────────────────────
    // Clamp to [0, 5]. If after clamping minRating > maxRating, drop maxRating.
    if (entities.minRating !== undefined || entities.maxRating !== undefined) {
        const clampedMin =
            entities.minRating !== undefined
                ? Math.max(MIN_RATING, Math.min(MAX_RATING, entities.minRating))
                : undefined;
        const clampedMax =
            entities.maxRating !== undefined
                ? Math.max(MIN_RATING, Math.min(MAX_RATING, entities.maxRating))
                : undefined;

        if (clampedMin !== undefined) {
            params.minRating = String(clampedMin);
        }
        if (clampedMax !== undefined) {
            // Drop maxRating if it's less than minRating after clamping.
            if (clampedMin === undefined || clampedMax >= clampedMin) {
                params.maxRating = String(clampedMax);
            }
        }
    }

    // ── Boolean amenity shortcuts ─────────────────────────────────────────────
    // Emitted as the string 'true' only — never native boolean.
    // Only set when the entity value is explicitly true (false/undefined → omit).
    if (entities.hasPool === true) {
        params.hasPool = 'true';
    }
    if (entities.hasWifi === true) {
        params.hasWifi = 'true';
    }
    if (entities.allowsPets === true) {
        params.allowsPets = 'true';
    }
    if (entities.hasParking === true) {
        params.hasParking = 'true';
    }

    // ── Amenities (resolved UUIDs from route handler) ─────────────────────────
    if (resolvedAmenityIds.length > 0) {
        params.amenities = [...resolvedAmenityIds];
    }

    // ── Features (resolved UUIDs from route handler) ──────────────────────────
    if (resolvedFeatureIds.length > 0) {
        params.features = [...resolvedFeatureIds];
    }

    // ── Availability dates ────────────────────────────────────────────────────
    // Both emitted as ISO date strings (YYYY-MM-DD).
    // If checkOut <= checkIn, drop both.
    if (entities.checkIn !== undefined || entities.checkOut !== undefined) {
        if (entities.checkIn !== undefined && entities.checkOut !== undefined) {
            const checkInDate = entities.checkIn;
            const checkOutDate = entities.checkOut;

            if (checkOutDate > checkInDate) {
                params.checkIn = toIsoDateString(checkInDate);
                params.checkOut = toIsoDateString(checkOutDate);
            }
            // If checkOut <= checkIn: drop both — no-op.
        } else if (entities.checkIn !== undefined) {
            params.checkIn = toIsoDateString(entities.checkIn);
        } else if (entities.checkOut !== undefined) {
            params.checkOut = toIsoDateString(entities.checkOut);
        }
    }

    return params;
}
