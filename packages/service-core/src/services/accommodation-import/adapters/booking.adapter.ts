/**
 * Booking.com Import Adapter (SPEC-222 T-015)
 *
 * Implements {@link ImportSourceAdapter} for Booking.com listing URLs.
 *
 * **Extraction strategy (two-tier):**
 *
 * 1. **Primary — direct fetch + JSON-LD ($0 cost):**
 *    Uses {@link safeExternalFetch} with realistic browser headers to retrieve
 *    the Booking.com page HTML, then runs {@link extractJsonLd} to pull
 *    structured `Hotel` / `LodgingBusiness` data.  This path costs nothing and
 *    works whenever Booking.com does not block the request.
 *
 * 2. **Fallback — Apify actor:**
 *    Triggered when the primary fetch is blocked/fails OR when JSON-LD yields
 *    fewer than {@link USEFUL_FIELD_THRESHOLD} structured fields.  Requires both
 *    `ctx.credentials.apifyToken` and `ctx.credentials.apifyBookingActor` to be
 *    present.  When either credential is absent the fallback is silently skipped
 *    (credential degradation, US-11).
 *
 * **Hard rule (SPEC-222)**: reviews and ratings are NEVER imported.
 * {@link extractJsonLd} already strips `aggregateRating` / `review` / etc.
 * The local {@link BookingItem} interface structurally excludes all rating/review
 * keys so they are unreachable even if the Apify actor returns them.
 *
 * **Error contract**: the `extract` method never throws.  Any exception is
 * caught internally and results in a minimal `{ sourcePlatform: 'booking' }`
 * degradation response.
 *
 * @module services/accommodation-import/adapters/booking
 */

import { safeExternalFetch } from '@repo/utils';
import type { ImportContext, ImportSourceAdapter, RawExtraction } from '../adapter.types.js';
import { extractJsonLd } from '../extractors/jsonld.js';
import { runApifyActor } from './apify-client.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum number of "useful" structured fields that the JSON-LD primary path
 * must produce before the Apify fallback is skipped.
 *
 * A field is considered useful when it is a defined, non-empty candidate in
 * the {@link RawExtraction}: `name`, `description`, `location.coordinates`,
 * `location.street`, `imageUrls` (at least one), `scrapedLocality`, and
 * `scrapedCountry` each count as one.
 *
 * If the count is below this threshold the primary result is discarded and
 * the adapter falls back to the Apify actor (when credentials are available).
 */
const USEFUL_FIELD_THRESHOLD = 2;

/**
 * Realistic browser User-Agent forwarded on the primary fetch to reduce the
 * chance of Booking.com returning a bot-detection page instead of real HTML.
 *
 * Using a recent Chrome on Windows because it closely mirrors Booking.com's
 * own JS-testing strategy (most blocked bots declare older or non-browser UAs).
 */
const BROWSER_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Booking.com Apify actor dataset item type
//
// Only the fields we actually read are declared here.  Any key that Apify
// actors are known to return for reviews/ratings is structurally ABSENT so
// TypeScript makes it impossible to accidentally map them.
// ---------------------------------------------------------------------------

/**
 * Coordinate pair as some Booking.com actors return it in a nested object.
 */
interface BookingCoordinates {
    readonly lat?: number | string | null | undefined;
    readonly lng?: number | string | null | undefined;
    readonly latitude?: number | string | null | undefined;
    readonly longitude?: number | string | null | undefined;
}

/**
 * Image entry — actors may return plain URL strings or objects with a `url`
 * or `src` property.
 */
type BookingImageEntry =
    | string
    | { readonly url?: string | null | undefined; readonly src?: string | null | undefined };

/**
 * The subset of a Booking.com actor dataset item that this adapter reads.
 *
 * **CRITICAL — SPEC-222 hard rule**: `reviews`, `reviewsCount`, `rating`,
 * `guestRating`, `starRating`, `reviewScore`, and any other review/rating key
 * are INTENTIONALLY ABSENT from this interface.  Because TypeScript only
 * surfaces declared keys on a typed object, mapping code in this file cannot
 * reference them — they are structurally unreachable.
 */
interface BookingItem {
    // Name
    readonly name?: string | null | undefined;
    readonly title?: string | null | undefined;

    // Description
    readonly description?: string | null | undefined;

    // Coordinates (flat form)
    readonly lat?: number | string | null | undefined;
    readonly lng?: number | string | null | undefined;
    readonly latitude?: number | string | null | undefined;
    readonly longitude?: number | string | null | undefined;

    // Coordinates (nested form)
    readonly coordinates?: BookingCoordinates | null | undefined;
    readonly location?: BookingCoordinates | null | undefined;

    // Address / locality
    readonly address?: string | null | undefined;
    readonly city?: string | null | undefined;
    readonly localizedCity?: string | null | undefined;

    // Country
    readonly country?: string | null | undefined;
    readonly countryCode?: string | null | undefined;

    // Images
    readonly photos?: readonly BookingImageEntry[] | null | undefined;
    readonly images?: readonly BookingImageEntry[] | null | undefined;

    // Accommodation type
    readonly propertyType?: string | null | undefined;
    readonly type?: string | null | undefined;

    // Capacity
    readonly maxGuests?: number | string | null | undefined;
    readonly personCapacity?: number | string | null | undefined;
    readonly guests?: number | string | null | undefined;

    // Rooms
    readonly bedrooms?: number | string | null | undefined;
    readonly bathrooms?: number | string | null | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers — coordinate parsing
// ---------------------------------------------------------------------------

/**
 * Attempts to parse a numeric coordinate value from an unknown raw input.
 * Accepts numbers and numeric strings; returns `null` for anything else.
 *
 * @param raw - Raw value from the dataset item.
 * @returns The coordinate as a string, or `null`.
 */
function parseCoordinate(raw: number | string | null | undefined): string | null {
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? String(n) : null;
}

/**
 * Extracts lat/long from a {@link BookingItem}, trying flat top-level fields
 * first (`lat`/`lng`, `latitude`/`longitude`) then nested `coordinates` /
 * `location` objects.
 *
 * @param item - The dataset item to inspect.
 * @returns `{ lat, long }` as strings, or `null` when no valid pair exists.
 */
function extractCoordinates(
    item: BookingItem
): { readonly lat: string; readonly long: string } | null {
    // Flat top-level (lat + lng)
    const flatLat = parseCoordinate(item.lat);
    const flatLng = parseCoordinate(item.lng);
    if (flatLat !== null && flatLng !== null) {
        return { lat: flatLat, long: flatLng };
    }

    // Flat top-level (latitude + longitude)
    const flatLat2 = parseCoordinate(item.latitude);
    const flatLng2 = parseCoordinate(item.longitude);
    if (flatLat2 !== null && flatLng2 !== null) {
        return { lat: flatLat2, long: flatLng2 };
    }

    // Nested coordinates object
    const nested = item.coordinates ?? item.location;
    if (nested) {
        const nestedLat = parseCoordinate(nested.lat ?? nested.latitude);
        const nestedLng = parseCoordinate(nested.lng ?? nested.longitude);
        if (nestedLat !== null && nestedLng !== null) {
            return { lat: nestedLat, long: nestedLng };
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Internal helpers — image URL extraction
// ---------------------------------------------------------------------------

/**
 * Normalises a heterogeneous images array (strings or `{url|src}` objects) to
 * a plain string array of absolute URLs.
 *
 * @param entries - Raw image entries from the dataset item.
 * @returns Array of URL strings; empty array when nothing is usable.
 */
function extractImageUrls(entries: readonly BookingImageEntry[] | null | undefined): string[] {
    if (!entries || entries.length === 0) return [];
    const result: string[] = [];
    for (const entry of entries) {
        if (typeof entry === 'string' && entry.length > 0) {
            result.push(entry);
        } else if (typeof entry === 'object' && entry !== null) {
            const href = entry.url ?? entry.src;
            if (typeof href === 'string' && href.length > 0) {
                result.push(href);
            }
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Internal helper — count useful fields in a RawExtraction
// ---------------------------------------------------------------------------

/**
 * Counts how many "useful" structured fields are present in a {@link RawExtraction}.
 *
 * Useful fields are: `name`, `description`, `location.coordinates`,
 * `location.street`, `imageUrls` (≥1 entry), `scrapedLocality`,
 * `scrapedCountry`.  Each counts as one regardless of how many images or
 * address components exist.
 *
 * This is used to decide whether the primary JSON-LD path produced enough data
 * to skip the Apify fallback, or whether the fallback should be attempted.
 *
 * @param raw - The extraction bag to evaluate.
 * @returns Integer count of useful fields present.
 */
function countUsefulFields(raw: RawExtraction): number {
    let count = 0;
    if (raw.name !== undefined) count++;
    if (raw.description !== undefined) count++;
    if (raw.location?.coordinates !== undefined) count++;
    if (raw.location?.street !== undefined) count++;
    if (raw.imageUrls !== undefined && raw.imageUrls.length > 0) count++;
    if (raw.scrapedLocality !== undefined) count++;
    if (raw.scrapedCountry !== undefined) count++;
    return count;
}

// ---------------------------------------------------------------------------
// Internal helper — map Apify dataset item to RawExtraction
// ---------------------------------------------------------------------------

/**
 * Maps the first dataset item returned by the Apify Booking.com actor to a
 * {@link RawExtraction}.
 *
 * All candidate fields are tagged `source: 'official_api'` because the data
 * originates from a structured Apify actor (not raw HTML scraping).
 *
 * **Hard rule (SPEC-222)**: reviews, ratings, and related fields are
 * structurally excluded via the typed {@link BookingItem} interface — they
 * cannot appear in the returned extraction even if the actor sent them.
 *
 * @param raw - The first item from the Apify actor's dataset (typed narrowly).
 * @returns A populated {@link RawExtraction} tagged `source: 'official_api'`.
 */
function mapApifyItemToRawExtraction(raw: BookingItem): RawExtraction {
    const result: {
        sourcePlatform: 'booking';
        name?: RawExtraction['name'];
        description?: RawExtraction['description'];
        type?: RawExtraction['type'];
        location?: RawExtraction['location'];
        imageUrls?: readonly string[];
        scrapedLocality?: string;
        scrapedCountry?: string;
        extraInfo?: RawExtraction['extraInfo'];
    } = { sourcePlatform: 'booking' };

    // -- name ------------------------------------------------------------------
    const nameRaw = raw.name ?? raw.title;
    if (nameRaw) {
        result.name = { value: nameRaw, source: 'official_api' };
    }

    // -- description -----------------------------------------------------------
    if (raw.description) {
        result.description = { value: raw.description, source: 'official_api' };
    }

    // -- type ------------------------------------------------------------------
    const typeRaw = raw.propertyType ?? raw.type;
    if (typeRaw) {
        result.type = { value: typeRaw, source: 'official_api' };
    }

    // -- location (coordinates) ------------------------------------------------
    const coords = extractCoordinates(raw);
    if (coords) {
        result.location = {
            coordinates: { value: coords, source: 'official_api' }
        };
    }

    // -- scrapedLocality -------------------------------------------------------
    const locality = raw.address ?? raw.localizedCity ?? raw.city;
    if (locality) {
        result.scrapedLocality = locality;
    }

    // -- scrapedCountry --------------------------------------------------------
    const country = raw.country ?? raw.countryCode;
    if (country) {
        result.scrapedCountry = country;
    }

    // -- imageUrls (try photos, then images) -----------------------------------
    const resolvedUrls =
        extractImageUrls(raw.photos).length > 0
            ? extractImageUrls(raw.photos)
            : extractImageUrls(raw.images);
    if (resolvedUrls.length > 0) {
        result.imageUrls = resolvedUrls;
    }

    // -- extraInfo (capacity, bedrooms, bathrooms) -----------------------------
    const capacityRaw = raw.maxGuests ?? raw.personCapacity ?? raw.guests;
    const capacity =
        capacityRaw != null
            ? typeof capacityRaw === 'number'
                ? capacityRaw
                : Number(capacityRaw)
            : null;
    const bedrooms =
        raw.bedrooms != null
            ? typeof raw.bedrooms === 'number'
                ? raw.bedrooms
                : Number(raw.bedrooms)
            : null;
    const bathrooms =
        raw.bathrooms != null
            ? typeof raw.bathrooms === 'number'
                ? raw.bathrooms
                : Number(raw.bathrooms)
            : null;

    const hasCapacity = capacity !== null && Number.isFinite(capacity);
    const hasBedrooms = bedrooms !== null && Number.isFinite(bedrooms);
    const hasBathrooms = bathrooms !== null && Number.isFinite(bathrooms);

    if (hasCapacity || hasBedrooms || hasBathrooms) {
        result.extraInfo = {
            ...(hasCapacity
                ? { capacity: { value: capacity, source: 'official_api' as const } }
                : {}),
            ...(hasBedrooms
                ? { bedrooms: { value: bedrooms, source: 'official_api' as const } }
                : {}),
            ...(hasBathrooms
                ? { bathrooms: { value: bathrooms, source: 'official_api' as const } }
                : {})
        };
    }

    return result;
}

// ---------------------------------------------------------------------------
// Internal helper — map JSON-LD result to RawExtraction
// ---------------------------------------------------------------------------

/**
 * Converts a {@link import('../extractors/jsonld.js').JsonLdResult} produced by
 * {@link extractJsonLd} into a {@link RawExtraction} with all candidates tagged
 * `source: 'jsonld'`.
 *
 * Rating/review fields are already stripped by `extractJsonLd` — this function
 * only maps the safe fields that are present in `JsonLdResult`.
 *
 * @param jsonLd - The result returned by `extractJsonLd({ html })`.
 * @returns A partial {@link RawExtraction}; fields absent in `jsonLd` are omitted.
 */
function mapJsonLdToRawExtraction(jsonLd: ReturnType<typeof extractJsonLd>): RawExtraction {
    const result: {
        sourcePlatform: 'booking';
        name?: RawExtraction['name'];
        description?: RawExtraction['description'];
        location?: RawExtraction['location'];
        imageUrls?: readonly string[];
        scrapedLocality?: string;
        scrapedCountry?: string;
    } = { sourcePlatform: 'booking' };

    if (jsonLd.name) {
        result.name = { value: jsonLd.name, source: 'jsonld' };
    }

    if (jsonLd.description) {
        result.description = { value: jsonLd.description, source: 'jsonld' };
    }

    // -- location (coordinates + street) --------------------------------------
    const geoResult = jsonLd.geo;
    const streetAddress = jsonLd.address?.streetAddress;
    const hasCoords = geoResult !== undefined;
    const hasStreet = streetAddress !== undefined;
    if (hasCoords || hasStreet) {
        result.location = {
            ...(hasCoords && geoResult !== undefined
                ? {
                      coordinates: {
                          value: {
                              lat: geoResult.latitude,
                              long: geoResult.longitude
                          },
                          source: 'jsonld' as const
                      }
                  }
                : {}),
            ...(hasStreet && streetAddress !== undefined
                ? {
                      street: {
                          value: streetAddress,
                          source: 'jsonld' as const
                      }
                  }
                : {})
        };
    }

    // -- imageUrls -------------------------------------------------------------
    if (jsonLd.imageUrls && jsonLd.imageUrls.length > 0) {
        result.imageUrls = jsonLd.imageUrls;
    }

    // -- scrapedLocality / scrapedCountry -------------------------------------
    if (jsonLd.scrapedLocality) {
        result.scrapedLocality = jsonLd.scrapedLocality;
    }
    if (jsonLd.scrapedCountry) {
        result.scrapedCountry = jsonLd.scrapedCountry;
    }

    return result;
}

// ---------------------------------------------------------------------------
// BookingAdapter
// ---------------------------------------------------------------------------

/**
 * Import adapter for Booking.com listing URLs.
 *
 * **Detection**: handles any URL whose hostname contains `booking.com`
 * (covers `.com`, `.com.ar`, country subdomains, etc.).
 *
 * **Extraction flow inside `extract()`:**
 *
 * 1. **Primary**: SSRF-safe fetch via {@link safeExternalFetch} with a
 *    realistic browser `User-Agent` + `Accept-Language` header.
 *    If the response is `ok`, runs {@link extractJsonLd} looking for
 *    `Hotel` / `LodgingBusiness` / similar schema.org types.  If ≥
 *    {@link USEFUL_FIELD_THRESHOLD} structured fields are found the result
 *    is returned immediately (tagged `source: 'jsonld'`, zero cost).
 *
 * 2. **Fallback**: If the page was blocked, the fetch failed, or JSON-LD
 *    produced fewer than {@link USEFUL_FIELD_THRESHOLD} useful fields, the
 *    adapter attempts the Apify fallback — provided both
 *    `ctx.credentials.apifyToken` and `ctx.credentials.apifyBookingActor`
 *    are present.  The first dataset item is mapped and tagged
 *    `source: 'official_api'`.  Missing credentials → fallback silently
 *    skipped (credential degradation US-11).
 *
 * 3. **Degrade**: If every path fails, returns `{ sourcePlatform: 'booking' }`
 *    without throwing.
 *
 * **Rating/review guarantee (SPEC-222)**: {@link extractJsonLd} strips rating
 * and review fields before returning.  The {@link BookingItem} interface
 * structurally excludes them for the Apify path.  The returned
 * {@link RawExtraction} is therefore guaranteed to be free of rating/review
 * data regardless of which path succeeds.
 *
 * @example
 * ```ts
 * const adapter = new BookingAdapter();
 * adapter.supports(new URL('https://www.booking.com/hotel/ar/x'));      // true
 * adapter.supports(new URL('https://www.booking.com.ar/hotel/ar/x'));   // true
 * adapter.supports(new URL('https://www.airbnb.com/rooms/12345'));       // false
 * ```
 */
export class BookingAdapter implements ImportSourceAdapter {
    /**
     * The import source identifier for this adapter.
     * Must match the `ImportSource` enum value `'booking'`.
     */
    readonly source = 'booking' as const;

    /**
     * Returns `true` when the URL belongs to any Booking.com domain (any TLD
     * or ccTLD variant).
     *
     * Matches `booking.com`, `booking.com.ar`, country-subdomain variants, etc.
     *
     * @param url - The parsed listing URL.
     * @returns `true` if this adapter handles the URL.
     */
    supports(url: URL): boolean {
        return url.hostname.toLowerCase().includes('booking.com');
    }

    /**
     * Extracts accommodation field candidates from a Booking.com listing URL.
     *
     * See the class-level JSDoc for the full two-tier extraction strategy.
     *
     * This method **never throws**.  All failure paths return a degraded
     * `{ sourcePlatform: 'booking' }` result.
     *
     * @param url - The parsed Booking.com listing URL.
     * @param ctx - Per-request context with credentials, timeout, and size limit.
     * @returns A {@link RawExtraction} with mapped fields, or a minimal
     *   `{ sourcePlatform: 'booking' }` on total failure.
     */
    async extract(url: URL, ctx: ImportContext): Promise<RawExtraction> {
        const empty: RawExtraction = { sourcePlatform: this.source };

        try {
            // -----------------------------------------------------------------
            // Step 1: Primary — SSRF-safe fetch + JSON-LD
            // -----------------------------------------------------------------
            let primaryBlocked = false;
            let primaryExtraction: RawExtraction = empty;

            const fetchResult = await safeExternalFetch({
                url: url.href,
                timeoutMs: ctx.timeoutMs,
                maxBytes: ctx.maxBytes,
                headers: {
                    'User-Agent': BROWSER_USER_AGENT,
                    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8'
                }
            });

            if (fetchResult.ok) {
                const jsonLd = extractJsonLd({ html: fetchResult.body });
                primaryExtraction = mapJsonLdToRawExtraction(jsonLd);

                if (countUsefulFields(primaryExtraction) >= USEFUL_FIELD_THRESHOLD) {
                    // Sufficient structured data — skip Apify, return immediately.
                    return primaryExtraction;
                }
                // Not enough fields — will try Apify fallback below.
            } else {
                // Blocked (bot-detection, SSRF policy, timeout, etc.)
                primaryBlocked = true;
            }

            // -----------------------------------------------------------------
            // Step 2: Fallback — Apify actor
            // Triggered when: fetch was blocked OR JSON-LD yielded < threshold.
            // -----------------------------------------------------------------
            const token = ctx.credentials.apifyToken;
            const actor = ctx.credentials.apifyBookingActor;

            if (!token || !actor) {
                // Credentials absent — skip fallback, return what we have.
                // If primary produced something (but < threshold), return it
                // rather than a completely empty result.
                if (!primaryBlocked && countUsefulFields(primaryExtraction) > 0) {
                    return primaryExtraction;
                }
                return empty;
            }

            const dataset = await runApifyActor({
                token,
                actor,
                actorInput: { startUrls: [{ url: url.href }] },
                timeoutMs: ctx.timeoutMs
            });

            if (dataset.length === 0) {
                // Actor returned nothing — degrade.
                return empty;
            }

            // Map the first dataset item (structurally excludes rating/review fields).
            const firstItem = dataset[0] as BookingItem;
            return mapApifyItemToRawExtraction(firstItem);
        } catch {
            // Catch-all: no exception must escape `extract`.
            return empty;
        }
    }
}
