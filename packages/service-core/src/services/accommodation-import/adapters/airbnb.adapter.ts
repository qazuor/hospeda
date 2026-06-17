/**
 * Airbnb Import Adapter (SPEC-222 T-016)
 *
 * Implements {@link ImportSourceAdapter} for Airbnb listing URLs (any TLD).
 * Uses the shared Apify client helper ({@link runApifyActor}) to call an
 * Apify actor that extracts structured data from the listing page.
 *
 * **Credential degradation (US-11)**: when either `ctx.credentials.apifyToken`
 * or `ctx.credentials.apifyAirbnbActor` is absent or empty the adapter returns
 * `{ sourcePlatform: 'airbnb' }` immediately — no network call is made and
 * no error is thrown.
 *
 * **Hard rule (SPEC-222)**: reviews and ratings are NEVER imported.  The local
 * `AirbnbItem` interface structurally excludes all review/rating keys so they
 * are unreachable even if the actor returns them in the dataset.
 *
 * **Actor input shape**: the adapter sends
 * `{ startUrls: [{ url: listingUrl }] }` as the actor `INPUT`.  This matches
 * the convention used by popular Apify Airbnb actors (e.g.
 * `dtrungtin/airbnb-scraper`, `maxcopell/airbnb-scraper`).  If you swap to an
 * actor with a different input schema, adjust the `actorInput` object passed
 * to {@link runApifyActor} accordingly — the provider is intentionally
 * swappable via the `ctx.credentials.apifyAirbnbActor` config value.
 *
 * @module services/accommodation-import/adapters/airbnb
 */

import type { ImportContext, ImportSourceAdapter, RawExtraction } from '../adapter.types.js';
import { runApifyActor } from './apify-client.js';

// ---------------------------------------------------------------------------
// Airbnb dataset item type
//
// Only the fields we actually read are declared here.  Any key that Apify
// actors are known to return for reviews/ratings is structurally ABSENT so
// TypeScript makes it impossible to accidentally map them.
// ---------------------------------------------------------------------------

/**
 * Coordinate pair as some actors return it in a nested object.
 */
interface AirbnbCoordinates {
    readonly lat?: number | string | null | undefined;
    readonly lng?: number | string | null | undefined;
    readonly latitude?: number | string | null | undefined;
    readonly longitude?: number | string | null | undefined;
}

/**
 * Image entry — actors may return plain URL strings or objects with a `url`
 * property.
 */
type AirbnbImageEntry = string | { readonly url?: string | null | undefined };

/**
 * Pricing sub-object as returned by some actors.
 */
interface AirbnbPricing {
    readonly rate?: number | string | null | undefined;
    readonly price?: number | string | null | undefined;
}

/**
 * The subset of an Airbnb actor dataset item that this adapter reads.
 *
 * **CRITICAL — SPEC-222 hard rule**: `reviews`, `reviewsCount`, `rating`,
 * `ratingBreakdown`, `starRating`, `reviewsList`, and any other review/rating
 * key are INTENTIONALLY ABSENT from this interface.  Because TypeScript only
 * surfaces declared keys on a typed object, mapping code in this file cannot
 * reference them — they are structurally unreachable.
 */
interface AirbnbItem {
    // Name
    readonly name?: string | null | undefined;
    readonly title?: string | null | undefined;

    // Description
    readonly description?: string | null | undefined;

    // Coordinates (flat form)
    readonly lat?: number | string | null | undefined;
    readonly lng?: number | string | null | undefined;

    // Coordinates (nested form)
    readonly coordinates?: AirbnbCoordinates | null | undefined;

    // Address / locality
    readonly address?: string | null | undefined;
    readonly localizedCity?: string | null | undefined;
    readonly city?: string | null | undefined;

    // Country
    readonly country?: string | null | undefined;

    // Images (array of urls or objects)
    readonly photos?: readonly AirbnbImageEntry[] | null | undefined;
    readonly images?: readonly AirbnbImageEntry[] | null | undefined;
    readonly pictures?: readonly AirbnbImageEntry[] | null | undefined;

    // Accommodation type
    readonly roomType?: string | null | undefined;
    readonly propertyType?: string | null | undefined;

    // Capacity
    readonly personCapacity?: number | string | null | undefined;
    readonly guests?: number | string | null | undefined;

    // Rooms
    readonly bedrooms?: number | string | null | undefined;
    readonly bathrooms?: number | string | null | undefined;

    // Price (flat number or nested object)
    readonly price?: number | string | AirbnbPricing | null | undefined;
    readonly pricing?: AirbnbPricing | null | undefined;
}

// ---------------------------------------------------------------------------
// Coordinate extraction helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to parse a numeric coordinate value from an unknown raw input.
 * Accepts numbers and numeric strings; returns `null` for anything else.
 *
 * @param raw - Raw value from the dataset item.
 * @returns The coordinate as a string (for `RawCandidateField.value`), or `null`.
 */
function parseCoordinate(raw: number | string | null | undefined): string | null {
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? String(n) : null;
}

/**
 * Extracts lat/long from an `AirbnbItem`, trying both the flat top-level
 * `lat`/`lng` fields and the nested `coordinates` object.
 *
 * @param item - The dataset item to inspect.
 * @returns `{ lat, long }` as strings, or `null` when no valid pair exists.
 */
function extractCoordinates(
    item: AirbnbItem
): { readonly lat: string; readonly long: string } | null {
    // Prefer flat top-level lat/lng
    const flatLat = parseCoordinate(item.lat);
    const flatLng = parseCoordinate(item.lng);
    if (flatLat !== null && flatLng !== null) {
        return { lat: flatLat, long: flatLng };
    }

    // Fall back to nested coordinates object
    const coords = item.coordinates;
    if (coords) {
        const nestedLat = parseCoordinate(coords.lat ?? coords.latitude);
        const nestedLng = parseCoordinate(coords.lng ?? coords.longitude);
        if (nestedLat !== null && nestedLng !== null) {
            return { lat: nestedLat, long: nestedLng };
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Image URL extraction helper
// ---------------------------------------------------------------------------

/**
 * Normalises a heterogeneous images array (strings or `{url}` objects) to a
 * plain string array of absolute URLs.
 *
 * @param entries - Raw image entries from the dataset item.
 * @returns Array of URL strings; empty array when nothing is usable.
 */
function extractImageUrls(entries: readonly AirbnbImageEntry[] | null | undefined): string[] {
    if (!entries || entries.length === 0) return [];
    const result: string[] = [];
    for (const entry of entries) {
        if (typeof entry === 'string' && entry.length > 0) {
            result.push(entry);
        } else if (
            typeof entry === 'object' &&
            entry !== null &&
            typeof entry.url === 'string' &&
            entry.url.length > 0
        ) {
            result.push(entry.url);
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Price extraction helper
// ---------------------------------------------------------------------------

/**
 * Attempts to extract a clean numeric price from the various shapes Airbnb
 * actors use (`number`, `string`, `{ rate }`, `{ price }`).
 *
 * Returns `null` when the value is absent or non-numeric.
 *
 * @param raw - The raw `price` or `pricing` field from the dataset item.
 * @returns A finite number, or `null`.
 */
function extractPrice(raw: number | string | AirbnbPricing | null | undefined): number | null {
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw === 'string') {
        const n = Number(raw.replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    // AirbnbPricing object
    const candidate = raw.rate ?? raw.price;
    return extractPrice(candidate);
}

// ---------------------------------------------------------------------------
// Dataset item → RawExtraction mapper
// ---------------------------------------------------------------------------

/**
 * Maps the first dataset item returned by the Apify actor to a
 * {@link RawExtraction}.
 *
 * All candidate fields are tagged `source: 'official_api'` because the data
 * originates from a structured Apify actor (not raw HTML scraping).
 *
 * **Hard rule**: reviews, ratings, and any related fields are structurally
 * excluded via the typed `AirbnbItem` interface and are never referenced here.
 *
 * @param raw - The first item from the Apify actor's dataset (typed narrowly).
 * @returns A populated {@link RawExtraction}.
 */
function mapItemToRawExtraction(raw: AirbnbItem): RawExtraction {
    const result: {
        sourcePlatform: 'airbnb';
        name?: RawExtraction['name'];
        description?: RawExtraction['description'];
        type?: RawExtraction['type'];
        location?: RawExtraction['location'];
        imageUrls?: readonly string[];
        scrapedLocality?: string;
        scrapedCountry?: string;
        extraInfo?: RawExtraction['extraInfo'];
        price?: RawExtraction['price'];
    } = { sourcePlatform: 'airbnb' };

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
    const typeRaw = raw.roomType ?? raw.propertyType;
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
    if (raw.country) {
        result.scrapedCountry = raw.country;
    }

    // -- imageUrls (try photos, then images, then pictures) --------------------
    const resolvedUrls =
        extractImageUrls(raw.photos).length > 0
            ? extractImageUrls(raw.photos)
            : extractImageUrls(raw.images).length > 0
              ? extractImageUrls(raw.images)
              : extractImageUrls(raw.pictures);
    if (resolvedUrls.length > 0) {
        result.imageUrls = resolvedUrls;
    }

    // -- extraInfo (capacity, bedrooms, bathrooms) -----------------------------
    const capacityRaw = raw.personCapacity ?? raw.guests;
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

    // -- price -----------------------------------------------------------------
    const priceValue = extractPrice(raw.price) ?? extractPrice(raw.pricing ?? null);
    if (priceValue !== null) {
        result.price = {
            price: { value: priceValue, source: 'official_api' }
        };
    }

    return result;
}

// ---------------------------------------------------------------------------
// AirbnbAdapter
// ---------------------------------------------------------------------------

/**
 * Import adapter for Airbnb listing URLs.
 *
 * Handles any Airbnb TLD (`.com`, `.com.ar`, `.mx`, `.co.uk`, etc.) by
 * checking whether the hostname contains `airbnb.`.  Uses the configured
 * Apify actor (via the shared {@link runApifyActor} helper) to extract
 * structured listing data.
 *
 * Degrades gracefully (returns `{ sourcePlatform: 'airbnb' }`) on:
 * - Missing `apifyToken` OR `apifyAirbnbActor` credential (US-11).
 * - Empty dataset response from the actor.
 * - Any network/timeout error (handled inside {@link runApifyActor}).
 *
 * @example
 * ```ts
 * const adapter = new AirbnbAdapter();
 * adapter.supports(new URL('https://www.airbnb.com/rooms/12345'));     // true
 * adapter.supports(new URL('https://www.airbnb.com.ar/rooms/12345'));  // true
 * adapter.supports(new URL('https://www.booking.com/hotel/ar/x'));     // false
 * ```
 */
export class AirbnbAdapter implements ImportSourceAdapter {
    /**
     * The import source identifier for this adapter.
     * Must match the `ImportSource` enum value `'airbnb'`.
     */
    readonly source = 'airbnb' as const;

    /**
     * Returns `true` when the URL belongs to any Airbnb domain (any TLD).
     *
     * Matches `airbnb.com`, `airbnb.com.ar`, `airbnb.mx`, `airbnb.co.uk`, etc.
     *
     * @param url - The parsed listing URL.
     * @returns `true` if this adapter handles the URL.
     */
    supports(url: URL): boolean {
        return url.hostname.toLowerCase().includes('airbnb.');
    }

    /**
     * Extracts accommodation field candidates from an Airbnb listing URL by
     * running the configured Apify actor.
     *
     * **Step 1 — Credential degradation (US-11)**: If `ctx.credentials.apifyToken`
     * or `ctx.credentials.apifyAirbnbActor` is absent or empty, returns
     * `{ sourcePlatform: 'airbnb' }` immediately.  No network call is made.
     *
     * **Step 2 — Actor call**: Sends `{ startUrls: [{ url: url.href }] }` as
     * the actor input.  This matches the convention used by the most common
     * Airbnb Apify actors.  Swapping to an actor with a different input schema
     * requires adjusting the `actorInput` shape passed here.
     *
     * **Step 3 — Result mapping**: The first dataset item is mapped to a
     * {@link RawExtraction} with all fields tagged `source: 'official_api'`.
     * If the dataset is empty the adapter degrades to an empty extraction.
     *
     * **Hard rule (SPEC-222)**: reviews, ratings, and related fields are
     * structurally excluded by the `AirbnbItem` type — they cannot appear
     * in the returned extraction even if the actor dataset includes them.
     *
     * @param url - The parsed Airbnb listing URL.
     * @param ctx - Per-request context with credentials and timeout.
     * @returns A {@link RawExtraction} with mapped fields, or a minimal
     *   `{ sourcePlatform: 'airbnb' }` on degradation.
     */
    async extract(url: URL, ctx: ImportContext): Promise<RawExtraction> {
        const empty: RawExtraction = { sourcePlatform: this.source };

        // -------------------------------------------------------------------
        // Step 1: Credential degradation (US-11)
        // Both token AND actor ID are required; missing either → degrade.
        // -------------------------------------------------------------------
        const token = ctx.credentials.apifyToken;
        const actor = ctx.credentials.apifyAirbnbActor;

        if (!token || !actor) {
            return empty;
        }

        // -------------------------------------------------------------------
        // Step 2: Run the Apify actor
        // actorInput shape: { startUrls: [{ url }] } — standard convention
        // for most Airbnb Apify actors.  If the chosen actor expects a
        // different schema (e.g. { urls: [...] }), update this object.
        // -------------------------------------------------------------------
        const dataset = await runApifyActor({
            token,
            actor,
            actorInput: { startUrls: [{ url: url.href }] },
            timeoutMs: ctx.timeoutMs
        });

        if (dataset.length === 0) {
            return empty;
        }

        // -------------------------------------------------------------------
        // Step 3: Map the first dataset item to RawExtraction
        // Cast to AirbnbItem — the interface deliberately omits review/rating
        // fields so they cannot be accessed regardless of what the actor sent.
        // -------------------------------------------------------------------
        const firstItem = dataset[0] as AirbnbItem;
        return mapItemToRawExtraction(firstItem);
    }
}
