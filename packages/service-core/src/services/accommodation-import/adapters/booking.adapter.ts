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

import { safeExternalFetch } from '@repo/utils/safe-fetch';
import type {
    AsyncExtractionResult,
    ImportContext,
    ImportSourceAdapter,
    RawExtraction
} from '../adapter.types.js';
import { extractJsonLd } from '../extractors/jsonld.js';
import { runApifyActor, startApifyRun } from './apify-client.js';
import { isPlausiblePerNightUsd } from './price-plausibility.js';
import { startApifyRunWithRetry } from './start-apify-run-with-retry.js';
import { withRetry } from './with-retry.js';

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

/**
 * Lead time in days ahead of today used as the check-in date for the price probe.
 */
const PRICE_PROBE_LEAD_DAYS = 30;

/**
 * Length of the price probe stay in nights. The actor returns the total price
 * for this many nights; we divide to get a per-night "from" figure.
 */
const PRICE_PROBE_NIGHTS = 2;

/**
 * Number of adults passed to the Booking.com actor for the price probe.
 */
const PRICE_PROBE_ADULTS = 2;

/**
 * ISO 4217 currency code requested from the actor.
 * The actor may return a display symbol (e.g. "US$") — we ignore it and always
 * store the currency we REQUESTED so the value is unambiguous.
 */
const PRICE_PROBE_CURRENCY = 'USD' as const;

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
 * A single facility entry inside a facility group, as returned by
 * `voyager/booking-scraper`.
 *
 * Real probe shape (SPEC-258):
 * ```json
 * { "name": "Free WiFi", "additionalInfo": { "requiresAdditionalCharge": false, "isOffSite": false }, "id": 47 }
 * ```
 */
interface BookingFacilityEntry {
    readonly name?: string | null | undefined;
    readonly additionalInfo?:
        | {
              readonly requiresAdditionalCharge?: boolean | null | undefined;
              readonly isOffSite?: boolean | null | undefined;
          }
        | null
        | undefined;
    readonly id?: number | string | null | undefined;
}

/**
 * A facility group as returned by `voyager/booking-scraper`.
 *
 * Real probe shape (SPEC-258):
 * ```json
 * { "name": "Great for your stay", "facilities": [{ "name": "Free WiFi", ... }], "overview": null, "id": null }
 * ```
 */
interface BookingFacilityGroup {
    readonly name?: string | null | undefined;
    readonly facilities?: readonly BookingFacilityEntry[] | null | undefined;
    readonly overview?: string | null | undefined;
    readonly id?: number | string | null | undefined;
}

/**
 * Nested address object as returned by `voyager/booking-scraper`.
 *
 * Real probe shape (SPEC-258):
 * ```json
 * { "full": "799 Almafuerte 799, 3260 Concepción del Uruguay, Argentina", "country": "ar", "city": "Concepción del Uruguay" }
 * ```
 */
interface BookingAddress {
    readonly full?: string | null | undefined;
    readonly city?: string | null | undefined;
    readonly country?: string | null | undefined;
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
 *
 * **Real shape note (SPEC-258)**: The `voyager/booking-scraper` actor returns:
 * - `type: "hotel"` — a clean string (NOT `propertyType`).
 * - `address: { full, city, country }` — an object, NOT a string.
 * - `location: { lat, lng }` — nested coordinate strings.
 * - `facilities: [{ name, facilities: [{ name, additionalInfo }] }]` — grouped amenities.
 * - `price: null`, `currency: null`, `rooms: []` — without check-in/out dates.
 *
 * Exported so the async run-status resolver (HOS-50 / SPEC-277 R3,
 * `resolve-import-run-status.ts`) can type the dataset item it hands to
 * {@link mapApifyItemToRawExtraction} without loosening the review/rating guard.
 */
export interface BookingItem {
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

    // Coordinates (nested form — voyager/booking-scraper uses `location: { lat, lng }`)
    readonly coordinates?: BookingCoordinates | null | undefined;
    readonly location?: BookingCoordinates | null | undefined;

    // Address / locality.
    // voyager/booking-scraper returns an object: { full, city, country }.
    // Older/generic actors may return a plain string. Both are accepted.
    readonly address?: string | BookingAddress | null | undefined;
    readonly city?: string | null | undefined;
    readonly localizedCity?: string | null | undefined;

    // Country (top-level string, used as fallback when address object is absent)
    readonly country?: string | null | undefined;
    readonly countryCode?: string | null | undefined;

    // Images
    readonly photos?: readonly BookingImageEntry[] | null | undefined;
    readonly images?: readonly (string | BookingImageEntry)[] | null | undefined;

    // Accommodation type.
    // voyager/booking-scraper returns `type: "hotel"` at the top level.
    readonly propertyType?: string | null | undefined;
    readonly type?: string | null | undefined;

    // Capacity
    readonly maxGuests?: number | string | null | undefined;
    readonly personCapacity?: number | string | null | undefined;
    readonly guests?: number | string | null | undefined;

    // Rooms
    readonly bedrooms?: number | string | null | undefined;
    readonly bathrooms?: number | string | null | undefined;

    // Grouped facility/amenity list.
    // voyager/booking-scraper shape: `[{ name, facilities: [{ name, additionalInfo }] }]`
    readonly facilities?: readonly BookingFacilityGroup[] | null | undefined;

    // Price — returned as a positive number when check-in/out dates are given.
    // voyager/booking-scraper real probe shape (SPEC-258):
    //   `"price": 157.3` — total for the whole stay (PRICE_PROBE_NIGHTS nights).
    //   `"price": null`  — when no dates are given or listing is unavailable.
    // Divide by PRICE_PROBE_NIGHTS to get a per-night figure.
    readonly price?: number | string | null | undefined;

    // Currency the actor priced the stay in. voyager/booking-scraper returns
    // `currency: null` without dates; with dates it echoes the pricing currency
    // (BETA-169 — read to detect when the actor ignored the requested USD).
    readonly currency?: string | null | undefined;
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
 * Extracts a locality string from the `address` field of a {@link BookingItem}.
 *
 * Handles two shapes:
 * - **String** (generic actors): returned as-is.
 * - **Object** (`voyager/booking-scraper` real shape: `{ full, city, country }`):
 *   returns `city` when available, otherwise `full`.
 *
 * @param address - Raw value from the dataset item's `address` field.
 * @returns Locality string, or `null` when not extractable.
 */
function extractLocalityFromAddress(
    address: string | BookingAddress | null | undefined
): string | null {
    if (address == null) return null;
    if (typeof address === 'string') return address.length > 0 ? address : null;
    // Object shape — prefer city, fall back to full address string
    if (typeof address.city === 'string' && address.city.length > 0) return address.city;
    if (typeof address.full === 'string' && address.full.length > 0) return address.full;
    return null;
}

/**
 * Extracts a country string from the `address` field of a {@link BookingItem}.
 *
 * The `voyager/booking-scraper` actor returns `address.country` as a two-letter
 * country code (e.g. `"ar"`). Falls back to the top-level `country` /
 * `countryCode` fields for other actor shapes.
 *
 * @param address - Raw value from the dataset item's `address` field.
 * @returns Country string, or `null` when not extractable.
 */
function extractCountryFromAddress(
    address: string | BookingAddress | null | undefined
): string | null {
    if (address == null || typeof address === 'string') return null;
    if (typeof address.country === 'string' && address.country.length > 0) return address.country;
    return null;
}

/**
 * Flattens the `facilities` array from a Booking.com actor item into a
 * deduplicated list of amenity name strings.
 *
 * Real probe shape (SPEC-258, `voyager/booking-scraper`):
 * ```json
 * [
 *   { "name": "Great for your stay", "facilities": [{ "name": "Free WiFi" }, { "name": "Bar" }] },
 *   { "name": "Outdoors", "facilities": [{ "name": "Outdoor furniture" }] }
 * ]
 * ```
 * Each group's `facilities[].name` is extracted. Group names themselves are NOT
 * included — only the individual facility names.
 *
 * @param groups - Raw facilities array from the dataset item.
 * @returns Deduplicated array of amenity name strings; empty when nothing is usable.
 */
function extractFacilityNames(
    groups: readonly BookingFacilityGroup[] | null | undefined
): string[] {
    if (!groups || groups.length === 0) return [];
    const names: string[] = [];
    for (const group of groups) {
        const items = group.facilities;
        if (!Array.isArray(items)) continue;
        for (const item of items) {
            if (typeof item.name === 'string' && item.name.trim().length > 0) {
                names.push(item.name.trim());
            }
        }
    }
    // Dedupe preserving order.
    return [...new Set(names)];
}

/**
 * Builds the check-in and check-out date strings (YYYY-MM-DD) for the price
 * probe. Check-in is {@link PRICE_PROBE_LEAD_DAYS} days from today;
 * check-out is {@link PRICE_PROBE_NIGHTS} nights later.
 *
 * Isolated into a pure helper so the single `new Date()` call is easy to audit.
 *
 * @returns `{ checkIn, checkOut }` as `YYYY-MM-DD` strings.
 */
function buildPriceProbeDates(): { readonly checkIn: string; readonly checkOut: string } {
    const toYMD = (d: Date): string => d.toISOString().slice(0, 10);
    const now = new Date();
    const checkInDate = new Date(now);
    checkInDate.setDate(now.getDate() + PRICE_PROBE_LEAD_DAYS);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkInDate.getDate() + PRICE_PROBE_NIGHTS);
    return { checkIn: toYMD(checkInDate), checkOut: toYMD(checkOutDate) };
}

/**
 * Extracts a per-night price from a Booking.com actor item's `price` field.
 *
 * `voyager/booking-scraper` returns `price` as a positive number representing
 * the TOTAL for the stay (not per-night). We divide by `nights` to normalize.
 *
 * Real probe shape (SPEC-258):
 * - With dates: `"price": 157.3` (total for 2 nights → 78.65/night).
 * - Without dates: `"price": null` → returns `null`.
 *
 * The caller tags the result `source: 'text'` (→ 50% confidence via
 * CONFIDENCE_BY_SOURCE) because this is a date-specific parsed estimate,
 * NOT the listing's authoritative base price.
 *
 * BETA-169: the computed per-night value is dropped when it falls outside the
 * plausible USD band ({@link isPlausiblePerNightUsd}). An implausibly high
 * value signals the actor ignored the requested USD currency and returned the
 * host's local currency instead (e.g. ARS, ~1000x), which would otherwise be
 * stored mislabelled as USD. Under-resolve is safer than mis-resolve.
 *
 * @param rawPrice - The raw `price` field from the dataset item.
 * @param nights - Number of probe nights used to divide total into per-night.
 * @returns A plausible per-night USD price, or `null`.
 */
function extractPerNightPriceBooking(
    rawPrice: number | string | null | undefined,
    nights: number
): number | null {
    if (rawPrice == null) return null;
    const total =
        typeof rawPrice === 'number'
            ? Number.isFinite(rawPrice)
                ? rawPrice
                : null
            : (() => {
                  const n = Number(String(rawPrice).replace(/[^0-9.]/g, ''));
                  return Number.isFinite(n) ? n : null;
              })();
    if (total === null || total <= 0) return null;
    const perNight = total / nights;
    return isPlausiblePerNightUsd(perNight) ? perNight : null;
}

/**
 * Decides whether the actor's echoed pricing currency is consistent with the
 * currency we REQUESTED ({@link PRICE_PROBE_CURRENCY}). This is the Booking-only
 * complement to the magnitude guard (BETA-169): the `voyager/booking-scraper`
 * actor echoes a `currency` field, so when it reports a clearly different ISO
 * currency (e.g. `"ARS"`) we know it ignored the USD request and the price must
 * NOT be stored labelled USD — regardless of the value's magnitude, which closes
 * the low-value mislabel gap the magnitude guard alone cannot.
 *
 * Conservative on purpose:
 * - Absent / empty currency → inconclusive → `true` (defer to the magnitude
 *   guard). Common: the actor returns `null` unless it has confident pricing.
 * - Ambiguous non-ISO strings (a bare `$`, `US$`, symbols) → inconclusive →
 *   `true`. We only treat a value as a mismatch when it is an unambiguous
 *   3-letter ISO-4217 alpha code that differs from the requested currency, so a
 *   genuine USD listing whose actor happens to echo a symbol is never dropped
 *   on this signal.
 *
 * @param rawCurrency - The actor's echoed `currency` field.
 * @returns `false` only when the actor clearly priced in a non-USD ISO currency.
 */
function actorCurrencyMatchesRequest(rawCurrency: string | null | undefined): boolean {
    // The dataset item is an unchecked `as BookingItem` cast over untrusted
    // Apify JSON, so `currency` may arrive as a non-string at runtime despite
    // the type. Guard with `typeof` (matching every other string-field read in
    // this file) — a bad type is inconclusive → defer, never throw. Throwing
    // here would bubble to the outer try/catch and discard the ENTIRE otherwise
    // valid extraction, a far worse under-resolve than dropping just the price.
    if (typeof rawCurrency !== 'string') return true;
    const normalized = rawCurrency.trim().toUpperCase();
    if (normalized.length === 0) return true;
    // Only a clear ISO-4217 alpha code is decisive; anything else is deferred.
    if (/^[A-Z]{3}$/.test(normalized)) {
        return normalized === PRICE_PROBE_CURRENCY;
    }
    return true;
}

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
 * **A4 (SPEC-258)**: Maps `type` → `result.type`, flattens `facilities`
 * groups into `result.amenityNames`, and maps `price` (total) ÷ nights
 * into a per-night "from" price when a positive number is present.
 *
 * Exported so the async run-status resolver (HOS-50 / SPEC-277 R3) can reuse
 * this exact mapping once a polled Apify run reaches `SUCCEEDED`, keeping a
 * single source of truth for the Booking.com dataset item shape.
 *
 * @param raw - The first item from the Apify actor's dataset (typed narrowly).
 * @returns A populated {@link RawExtraction} tagged `source: 'official_api'`.
 */
export function mapApifyItemToRawExtraction(raw: BookingItem): RawExtraction {
    const result: {
        sourcePlatform: 'booking';
        name?: RawExtraction['name'];
        description?: RawExtraction['description'];
        type?: RawExtraction['type'];
        location?: RawExtraction['location'];
        imageUrls?: readonly string[];
        amenityNames?: readonly string[];
        price?: RawExtraction['price'];
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
    // voyager/booking-scraper returns `type: "hotel"` at top level.
    // Some actors may use `propertyType` instead.
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
    // voyager/booking-scraper: `address` is an object `{ full, city, country }`.
    // Fall back to top-level `localizedCity` / `city` for other actor shapes.
    const locality =
        extractLocalityFromAddress(raw.address) ?? raw.localizedCity ?? raw.city ?? null;
    if (locality) {
        result.scrapedLocality = locality;
    }

    // -- scrapedCountry --------------------------------------------------------
    // voyager/booking-scraper: country lives inside `address.country`.
    // Fall back to top-level `country` / `countryCode` for other actor shapes.
    const country =
        extractCountryFromAddress(raw.address) ?? raw.country ?? raw.countryCode ?? null;
    if (country) {
        result.scrapedCountry = country;
    }

    // -- imageUrls (try photos, then images) -----------------------------------
    // voyager/booking-scraper returns `images` as a plain string array.
    const photoUrls = extractImageUrls(raw.photos);
    const imageUrls =
        photoUrls.length > 0
            ? photoUrls
            : extractImageUrls(raw.images as readonly BookingImageEntry[] | null | undefined);
    if (imageUrls.length > 0) {
        result.imageUrls = imageUrls;
    }

    // -- amenityNames (A4 — SPEC-258) ------------------------------------------
    // voyager/booking-scraper exposes `facilities[].facilities[].name`.
    // Flatten all groups and deduplicate.
    const amenityNames = extractFacilityNames(raw.facilities);
    if (amenityNames.length > 0) {
        result.amenityNames = amenityNames;
    }

    // -- price (from-price probe — A price probe, SPEC-258) --------------------
    // voyager/booking-scraper returns `price` as the TOTAL for the stay
    // (PRICE_PROBE_NIGHTS nights) when check-in/check-out params are sent.
    // We divide by PRICE_PROBE_NIGHTS to get a per-night orientative price.
    // When dates are absent the actor returns null — skip in that case.
    // Tagged `source: 'text'` (→ 50% confidence via CONFIDENCE_BY_SOURCE):
    // this is a date-specific parsed estimate, not the listing's authoritative
    // base price. Signals "plausible, requires host review" to the pipeline.
    //
    // BETA-169: two independent gates protect against storing a value in the
    // wrong currency labelled USD — (1) extractPerNightPriceBooking drops
    // implausible magnitudes; (2) actorCurrencyMatchesRequest drops the price
    // when the actor clearly priced in a non-USD ISO currency (e.g. ARS), which
    // catches mislabels the magnitude guard would miss. When either gate fails,
    // `price` is left absent for the host to fill in.
    const perNightPrice = extractPerNightPriceBooking(raw.price, PRICE_PROBE_NIGHTS);
    if (perNightPrice !== null && actorCurrencyMatchesRequest(raw.currency)) {
        result.price = {
            price: { value: perNightPrice, source: 'text' },
            currency: { value: PRICE_PROBE_CURRENCY, source: 'text' }
        };
    }

    // -- extraInfo (capacity, bedrooms, bathrooms) -----------------------------
    const capacityRaw = raw.maxGuests ?? raw.personCapacity ?? raw.guests;
    const capacity =
        capacityRaw == null
            ? null
            : typeof capacityRaw === 'number'
              ? capacityRaw
              : Number(capacityRaw);
    const bedrooms =
        raw.bedrooms == null
            ? null
            : typeof raw.bedrooms === 'number'
              ? raw.bedrooms
              : Number(raw.bedrooms);
    const bathrooms =
        raw.bathrooms == null
            ? null
            : typeof raw.bathrooms === 'number'
              ? raw.bathrooms
              : Number(raw.bathrooms);

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
 * **A4a (SPEC-258)**: forwards `jsonLd.lodgingType` → `result.type` via a
 * raw string pass-through (the JSON-LD `@type` value, e.g. `"Hotel"`). The
 * downstream mapping pipeline (`mapAccommodationType`) converts it to the
 * internal enum value. This mirrors what `generic.adapter.ts` does.
 *
 * @param jsonLd - The result returned by `extractJsonLd({ html })`.
 * @returns A partial {@link RawExtraction}; fields absent in `jsonLd` are omitted.
 */
function mapJsonLdToRawExtraction(jsonLd: ReturnType<typeof extractJsonLd>): RawExtraction {
    const result: {
        sourcePlatform: 'booking';
        name?: RawExtraction['name'];
        description?: RawExtraction['description'];
        type?: RawExtraction['type'];
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

    // -- type (A4a) ------------------------------------------------------------
    // Forward the schema.org @type from the JSON-LD node (e.g. "Hotel") so the
    // downstream pipeline can map it to an AccommodationTypeEnum value.
    if (jsonLd.lodgingType) {
        result.type = { value: jsonLd.lodgingType, source: 'jsonld' };
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
        const host = url.hostname.toLowerCase();
        // Exact match, subdomain (www.booking.com, secure.booking.com), or ccTLD
        // variant (booking.com.ar, www.booking.com.ar).  The bounded regex prevents
        // booking.com.attacker.com from matching (CodeQL URL-substring fix).
        return (
            host === 'booking.com' ||
            host.endsWith('.booking.com') ||
            /^(?:[a-z0-9-]+\.)*booking\.com\.[a-z]{2,3}$/.test(host)
        );
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
                // Credentials absent — skip fallback.
                // If primary produced something (but < threshold), return it
                // rather than a completely empty result.
                if (!primaryBlocked && countUsefulFields(primaryExtraction) > 0) {
                    return primaryExtraction;
                }
                // Both primary blocked and no Apify creds → credentials_missing.
                return { sourcePlatform: this.source, failureCode: 'credentials_missing' };
            }

            // Build date-based price probe so the actor returns a real price.
            const { checkIn, checkOut } = buildPriceProbeDates();
            // Retry transient blocks (source_blocked / timeout) before degrading;
            // only the actor call is wrapped — the JSON-LD path above is untouched (SPEC-277 R1).
            const result = await withRetry({
                fn: () =>
                    runApifyActor({
                        token,
                        actor,
                        actorInput: {
                            startUrls: [{ url: url.href }],
                            checkIn,
                            checkOut,
                            adults: PRICE_PROBE_ADULTS,
                            currency: PRICE_PROBE_CURRENCY
                        },
                        // Apify actors run synchronously for 8-120s — use the longer Apify
                        // budget, not the short JSON-LD fetch timeout, or the run always aborts.
                        timeoutMs: ctx.apifyTimeoutMs ?? ctx.timeoutMs
                    })
            });

            // Propagate transport-level failure codes from the Apify client.
            if (result.failureCode !== undefined) {
                return { sourcePlatform: this.source, failureCode: result.failureCode };
            }

            if (result.items.length === 0) {
                // Actor returned nothing — Booking is heavily anti-bot.
                return { sourcePlatform: this.source, failureCode: 'source_blocked' };
            }

            // Map the first dataset item (structurally excludes rating/review fields).
            const firstItem = result.items[0] as BookingItem;
            return mapApifyItemToRawExtraction(firstItem);
        } catch {
            // Catch-all: no exception must escape `extract`.
            return empty;
        }
    }

    /**
     * Starts an async Apify run for a Booking.com listing URL, but ONLY when
     * the free JSON-LD-first tier is insufficient (HOS-50 / SPEC-277 R3).
     *
     * **Reuses `extract()`'s primary tier unchanged**: the same SSRF-safe
     * fetch + {@link extractJsonLd} + {@link USEFUL_FIELD_THRESHOLD} check. If
     * that already yields enough structured data, this method resolves
     * synchronously with `{ raw }` — no Apify run is started, and callers
     * (the orchestrator, T-010) MUST NOT call this method again for the same
     * request in that case; the caller should have used `extract()` directly
     * had it known the JSON-LD tier would be sufficient. In practice callers
     * simply always try `extractAsync()` for Booking and branch on whether the
     * result is a run handle (`runId`/`datasetId`) or an already-resolved `raw`.
     *
     * Only past the primary tier does this method start the async run via
     * {@link startApifyRunWithRetry} (T-004) instead of the sync `withRetry`
     * + `runApifyActor` path — same credential degradation and actor-input
     * shape as the sync Apify fallback in `extract()`.
     *
     * **Never throws** — mirrors `extract()`'s catch-all, degrading to
     * `{ raw: { sourcePlatform: 'booking' } }` on any unexpected error.
     *
     * @param url - The parsed Booking.com listing URL.
     * @param ctx - Per-request context with credentials, timeout, and size limit.
     * @returns `{ raw }` when JSON-LD alone was sufficient (or partial data
     *   with no Apify credentials to fall back on), a run handle to poll, or
     *   `{ failureCode }` when the start call could not even begin.
     */
    async extractAsync(url: URL, ctx: ImportContext): Promise<AsyncExtractionResult> {
        const empty: RawExtraction = { sourcePlatform: this.source };

        try {
            // -----------------------------------------------------------------
            // Step 1: Primary — SSRF-safe fetch + JSON-LD (identical to extract()).
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
                    // Sufficient structured data — no async run needed.
                    return { raw: primaryExtraction };
                }
                // Not enough fields — will try the Apify async fallback below.
            } else {
                // Blocked (bot-detection, SSRF policy, timeout, etc.)
                primaryBlocked = true;
            }

            // -----------------------------------------------------------------
            // Step 2: Start the async Apify run — credential degradation
            // mirrors extract()'s sync Apify fallback exactly.
            // -----------------------------------------------------------------
            const token = ctx.credentials.apifyToken;
            const actor = ctx.credentials.apifyBookingActor;

            if (!token || !actor) {
                // Credentials absent — skip the async run.
                // If primary produced something (but < threshold), return it
                // rather than a completely empty result.
                if (!primaryBlocked && countUsefulFields(primaryExtraction) > 0) {
                    return { raw: primaryExtraction };
                }
                // Both primary blocked and no Apify creds → credentials_missing.
                return { failureCode: 'credentials_missing' };
            }

            // Build date-based price probe so the actor returns a real price.
            const { checkIn, checkOut } = buildPriceProbeDates();
            const result = await startApifyRunWithRetry({
                fn: () =>
                    startApifyRun({
                        token,
                        actor,
                        actorInput: {
                            startUrls: [{ url: url.href }],
                            checkIn,
                            checkOut,
                            adults: PRICE_PROBE_ADULTS,
                            currency: PRICE_PROBE_CURRENCY
                        }
                    })
            });

            if (result === null) {
                return { failureCode: 'provider_error' };
            }

            return { runId: result.runId, datasetId: result.defaultDatasetId };
        } catch {
            // Catch-all: no exception must escape `extractAsync`.
            return { raw: empty };
        }
    }
}
