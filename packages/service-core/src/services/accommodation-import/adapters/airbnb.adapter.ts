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
 * `{ startUrls: [{ url: listingUrl }], locale? }` as the actor `INPUT`. The
 * `locale` (mapped from `ctx.locale` — see {@link mapAirbnbActorLocale}) makes
 * the actor return the listing in the user's language. The default actor is
 * `tri_angle/airbnb-rooms-urls-scraper` (accepts /rooms/ detail URLs; do NOT
 * use `tri_angle/airbnb-scraper`, which is a search scraper that rejects detail
 * URLs). The item shape mapped here: `title`, `description`, `metaDescription`,
 * `subDescription.items`, `amenities` (grouped values array), `coordinates`,
 * `images` (objects with `imageUrl` key), `location`. If you swap to an actor
 * with a different schema, adjust both `actorInput` and
 * {@link mapItemToRawExtraction} — the provider is swappable via the
 * `ctx.credentials.apifyAirbnbActor` config value.
 *
 * NOTE: the locale MUST NOT be appended to the listing URL as `?locale=` — that
 * breaks the tri_angle actor (empty dataset). It goes in the actor input only.
 *
 * **Price probe (SPEC-258)**: the adapter sends `checkIn`, `checkOut`, `adults`,
 * and `currency` in the actor input so the actor can return a real price. Dates
 * are computed dynamically (today + {@link PRICE_PROBE_LEAD_DAYS} days for
 * check-in, + {@link PRICE_PROBE_NIGHTS} nights for check-out). When the actor
 * returns a parseable price, a per-night "from" figure is stored in
 * `raw.price.price`. The `RawCandidateField` layer has no `confidence` field;
 * the mapping step must apply a lower confidence to this orientative estimate.
 *
 * @module services/accommodation-import/adapters/airbnb
 */

import type { ImportContext, ImportSourceAdapter, RawExtraction } from '../adapter.types.js';
import { runApifyActor } from './apify-client.js';

// ---------------------------------------------------------------------------
// Price probe constants
// ---------------------------------------------------------------------------

/**
 * Lead time in days ahead of today used as the check-in date for the price probe.
 * A near-future date maximises the chance the listing has real pricing.
 */
const PRICE_PROBE_LEAD_DAYS = 30;

/**
 * Length of the price probe stay in nights. Two nights is the minimum that most
 * OTA pricing engines accept and provides a meaningful per-night average.
 */
const PRICE_PROBE_NIGHTS = 2;

/**
 * Number of adults passed to the actor for the price probe.
 */
const PRICE_PROBE_ADULTS = 2;

/**
 * ISO 4217 currency code requested from the actor.
 * The actor may return a display symbol (e.g. "$") — we ignore it and always
 * store the currency we REQUESTED so the value is unambiguous.
 */
const PRICE_PROBE_CURRENCY = 'USD' as const;

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
 * property (generic shape) or `imageUrl` property (tri_angle/airbnb-rooms-urls-scraper
 * returns `{ caption, imageUrl, orientation }` objects).
 */
type AirbnbImageEntry =
    | string
    | {
          readonly url?: string | null | undefined;
          readonly imageUrl?: string | null | undefined;
      };

/**
 * A single price line inside the `breakDown` object returned by
 * `tri_angle/airbnb-rooms-urls-scraper` when check-in/out dates are given.
 *
 * Real probe shape (SPEC-258):
 * ```json
 * { "description": "2 nights x $157.32", "price": "$314.63" }
 * ```
 */
interface AirbnbPriceBreakDownLine {
    readonly description?: string | null | undefined;
    readonly price?: string | null | undefined;
}

/**
 * The `breakDown` sub-object inside the date-based price response.
 *
 * Real probe shape (SPEC-258):
 * ```json
 * {
 *   "basePrice": { "description": "2 nights x $157.32", "price": "$314.63" },
 *   "total":     { "price": "$315", "description": "Total (calculated price, may vary)" }
 * }
 * ```
 */
interface AirbnbPriceBreakDown {
    readonly basePrice?: AirbnbPriceBreakDownLine | null | undefined;
    readonly total?: AirbnbPriceBreakDownLine | null | undefined;
}

/**
 * Price sub-object as returned by `tri_angle/airbnb-rooms-urls-scraper`.
 *
 * Two shapes:
 * - **Dateless / unavailable**: `{ "label": "To get prices, specify check-in..." }`
 *   (no `price` / `breakDown` fields).
 * - **With dates**: `{ "label": "$315 for 2 nights", "qualifier": "for 2 nights",
 *   "price": "$315", "breakDown": { "basePrice": {...}, "total": {...} } }`.
 *
 * This interface covers generic shapes too (`rate`, numeric `price` from other actors).
 */
interface AirbnbPricing {
    readonly label?: string | null | undefined;
    readonly qualifier?: string | null | undefined;
    /** Total price as a currency-symbol string, e.g. `"$315"`. */
    readonly price?: string | number | null | undefined;
    readonly breakDown?: AirbnbPriceBreakDown | null | undefined;
    // Generic actor fields
    readonly rate?: number | string | null | undefined;
}

/**
 * Amenity entry — Apify Airbnb actors return amenities heterogeneously:
 *
 * 1. **Plain string array** — older actors.
 * 2. **Flat `{ title | name, available }` objects** — generic actors.
 * 3. **Grouped objects** — `tri_angle/airbnb-rooms-urls-scraper` (real shape,
 *    SPEC-258 probe):
 *    ```json
 *    { "title": "Internet and office", "values": [
 *      { "title": "Wifi", "subtitle": "", "icon": "SYSTEM_WI_FI", "available": true }
 *    ] }
 *    ```
 *    Group-level entries have a `values` array of individual amenity items.
 *    Only items with `available !== false` are included. The "Not included" group
 *    contains items with `available: false` (e.g. Washer, Dryer).
 *
 * A single interface covers all three shapes — the `values` field is optional,
 * allowing the same type to represent both group entries (have `values`) and
 * individual amenity items (no `values`, have `available`).
 *
 * {@link extractAmenityNames} normalises all shapes to a flat deduplicated name list.
 */
type AirbnbAmenityEntry =
    | string
    | {
          readonly title?: string | null | undefined;
          readonly name?: string | null | undefined;
          readonly subtitle?: string | null | undefined;
          readonly icon?: string | null | undefined;
          readonly available?: boolean | null | undefined;
          /** Present on group entries; absent on individual amenity items. */
          readonly values?: readonly AirbnbAmenityEntry[] | null | undefined;
      };

/**
 * The capacity sub-description block. The tri_angle actor returns the
 * capacity line as a localized string array, e.g.
 * `{ title: '...', items: ['11 guests', '3 bedrooms', '8 beds', '1 bath'] }`.
 */
interface AirbnbSubDescription {
    readonly title?: string | null | undefined;
    readonly items?: readonly (string | null | undefined)[] | null | undefined;
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

    // Short summary candidates. The tri_angle actor exposes `metaDescription`
    // (a one-paragraph blurb); other actors may use `summary`/`publicDescription`.
    readonly summary?: string | null | undefined;
    readonly publicDescription?: string | null | undefined;
    readonly metaDescription?: string | null | undefined;

    // subDescription carries the capacity line as a localized string array, e.g.
    // { items: ["11 guests", "3 bedrooms", "8 beds", "1 bath"] } (or its es/pt form).
    readonly subDescription?: AirbnbSubDescription | null | undefined;

    // Amenities (heterogeneous shapes — see AirbnbAmenityEntry)
    readonly amenities?: readonly AirbnbAmenityEntry[] | null | undefined;

    // Beds (distinct from bedrooms) — top-level fallback; tri_angle puts it in subDescription
    readonly beds?: number | string | null | undefined;

    // Coordinates (flat form)
    readonly lat?: number | string | null | undefined;
    readonly lng?: number | string | null | undefined;

    // Coordinates (nested form)
    readonly coordinates?: AirbnbCoordinates | null | undefined;

    // Address / locality. tri_angle exposes a single `location` string.
    readonly location?: string | null | undefined;
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

    // Price — tri_angle/airbnb-rooms-urls-scraper always returns an object:
    // dateless → { label: "To get prices..." }, with dates → { label, price, breakDown }.
    // Generic actors may return a plain number or string.
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
 * Normalises a heterogeneous images array to a plain string array of absolute URLs.
 *
 * Handles three entry shapes:
 * - Plain URL string.
 * - `{ url: string }` — generic actor shape.
 * - `{ imageUrl: string }` — `tri_angle/airbnb-rooms-urls-scraper` shape
 *   (real probe: `{ caption, imageUrl, orientation }`).
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
        } else if (typeof entry === 'object' && entry !== null) {
            // Prefer `imageUrl` (rooms-urls-scraper), fall back to `url` (generic shape).
            const href =
                (typeof entry.imageUrl === 'string' && entry.imageUrl.length > 0
                    ? entry.imageUrl
                    : null) ??
                (typeof entry.url === 'string' && entry.url.length > 0 ? entry.url : null);
            if (href !== null) {
                result.push(href);
            }
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Price extraction helpers
// ---------------------------------------------------------------------------

/**
 * Parses a numeric price value from a currency-symbol string (e.g. `"$315"`,
 * `"$157.32"`, `"$1,200.00"`).
 *
 * Strategy (mirrors `generic.adapter.ts#parsePriceFromRange`):
 * 1. Strip currency symbols and letter characters.
 * 2. Remove comma thousands-separators (`,`).
 * 3. Accept only strings that now match `^\d+(\.\d{1,2})?$` — at most two
 *    decimal places. This rejects European-format strings like `"1.200"` (three
 *    decimal places after the dot) which would otherwise be mis-parsed as `1.2`.
 *    Under-resolve is safer than mis-resolve.
 *
 * @param raw - A price string possibly prefixed with a currency symbol.
 * @returns A positive finite number, or `null`.
 */
function parseCurrencyString(raw: string | null | undefined): number | null {
    if (!raw || raw.trim().length === 0) return null;
    // Remove currency symbols / letters; remove comma thousands-separators.
    const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '');
    // Reject if not a clean integer or decimal with ≤2 decimal places.
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Attempts to extract a per-night price from the price object returned by
 * `tri_angle/airbnb-rooms-urls-scraper` when check-in/out dates are provided.
 *
 * **Extraction order (SPEC-258):**
 * 1. Parse the per-night rate from `breakDown.basePrice.description`
 *    (e.g. `"2 nights x $157.32"` → `157.32`). This is the most accurate
 *    source because it's already per-night.
 * 2. Fall back to dividing `breakDown.total.price` by `nights`
 *    (e.g. `"$315"` ÷ 2 → `157.5`).
 * 3. Fall back to dividing the top-level `price.price` string by `nights`.
 * 4. Fall back to dividing a numeric/string top-level price by `nights`
 *    (for generic actor shapes that return a flat number or string).
 *
 * Returns `null` when no price can be derived OR when the computed per-night
 * value is `< 1` (a sub-$1/night result indicates a mis-parse or placeholder).
 * Under-resolve is always safer than mis-resolve.
 *
 * @param raw - The raw `price` field from the dataset item.
 * @param nights - Number of probe nights used to divide a total into per-night.
 * @returns A finite per-night price `≥ 1`, or `null`.
 */
function extractPerNightPrice(
    raw: number | string | AirbnbPricing | null | undefined,
    nights: number
): number | null {
    if (raw == null) return null;

    // Flat number (generic actors)
    if (typeof raw === 'number') {
        const perNight = raw / nights;
        return Number.isFinite(perNight) && perNight >= 1 ? perNight : null;
    }

    // Flat string (generic actors — e.g. "157.32")
    if (typeof raw === 'string') {
        const total = parseCurrencyString(raw);
        if (total === null) return null;
        const perNight = total / nights;
        return Number.isFinite(perNight) && perNight >= 1 ? perNight : null;
    }

    // AirbnbPricing object (rooms-urls-scraper)
    const pricing = raw;

    // 1. Parse per-night from breakDown.basePrice.description: "N nights x $157.32"
    const basePriceDesc = pricing.breakDown?.basePrice?.description;
    if (typeof basePriceDesc === 'string') {
        // Match "N nights x $<amount>" — extract the per-night dollar figure.
        // Use parseCurrencyString for the captured amount so that European-format
        // strings (e.g. "x $1.200") are rejected rather than mis-parsed as 1.2.
        const perNightMatch = /x\s*\$?([\d,.]+)/i.exec(basePriceDesc);
        if (perNightMatch?.[1]) {
            const n = parseCurrencyString(perNightMatch[1]);
            if (n !== null && n >= 1) return n;
        }
    }

    // 2. Divide breakDown.total.price by nights
    const totalPriceStr = pricing.breakDown?.total?.price;
    if (totalPriceStr) {
        const total = parseCurrencyString(String(totalPriceStr));
        if (total !== null) {
            const perNight = total / nights;
            if (Number.isFinite(perNight) && perNight >= 1) return perNight;
        }
    }

    // 3. Divide top-level price.price by nights (e.g. "$315")
    const topPriceStr = pricing.price;
    if (topPriceStr != null) {
        const total =
            typeof topPriceStr === 'number'
                ? Number.isFinite(topPriceStr)
                    ? topPriceStr
                    : null
                : parseCurrencyString(String(topPriceStr));
        if (total !== null) {
            const perNight = total / nights;
            if (Number.isFinite(perNight) && perNight >= 1) return perNight;
        }
    }

    // 4. Generic fallback: rate field
    if (pricing.rate != null) {
        const rateRaw =
            typeof pricing.rate === 'number'
                ? pricing.rate
                : parseCurrencyString(String(pricing.rate));
        if (rateRaw !== null && Number.isFinite(rateRaw) && rateRaw >= 1) return rateRaw;
    }

    return null;
}

/**
 * Builds the check-in and check-out date strings (YYYY-MM-DD) for the price
 * probe. Check-in is {@link PRICE_PROBE_LEAD_DAYS} days from today;
 * check-out is {@link PRICE_PROBE_NIGHTS} nights later.
 *
 * Isolated into a pure helper so that tests can stub date generation if needed,
 * and so that the single `new Date()` call is easy to audit.
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

// ---------------------------------------------------------------------------
// Amenity name extraction helper
// ---------------------------------------------------------------------------

/**
 * Flattens a heterogeneous amenities array to a deduplicated list of name
 * strings. Handles plain strings, `{ name | title }` objects, and grouped
 * objects carrying a nested `values` array. Entries explicitly marked
 * `available: false` are skipped.
 *
 * @param entries - Raw amenities from the dataset item.
 * @returns Array of amenity name strings; empty array when nothing is usable.
 */
function extractAmenityNames(entries: readonly AirbnbAmenityEntry[] | null | undefined): string[] {
    if (!entries || entries.length === 0) return [];
    const names: string[] = [];
    const visit = (entry: AirbnbAmenityEntry): void => {
        if (typeof entry === 'string') {
            const trimmed = entry.trim();
            if (trimmed.length > 0) names.push(trimmed);
            return;
        }
        if (entry === null || typeof entry !== 'object') return;
        if (Array.isArray(entry.values) && entry.values.length > 0) {
            for (const child of entry.values) visit(child);
            return;
        }
        if (entry.available === false) return;
        const label = (entry.name ?? entry.title ?? '').trim();
        if (label.length > 0) names.push(label);
    };
    for (const entry of entries) visit(entry);
    // Dedupe preserving order.
    return [...new Set(names)];
}

// ---------------------------------------------------------------------------
// Capacity sub-description parser
// ---------------------------------------------------------------------------

interface ParsedCapacity {
    capacity?: number;
    bedrooms?: number;
    beds?: number;
    bathrooms?: number;
}

/**
 * Parses the capacity figures out of a {@link AirbnbSubDescription} item list.
 * The tri_angle actor returns localized strings such as `"3 bedrooms"` /
 * `"3 habitaciones"` / `"3 quartos"`, `"8 beds"` / `"8 camas"`,
 * `"1 bath"` / `"1 baño"` / `"1 banheiro"`, `"11 guests"` / `"11 huéspedes"`.
 *
 * Each entry is matched as `<number> <label>` and classified by keyword. Order
 * matters: "bedroom"/"habitación" is checked before the bare "bed"/"cama" so a
 * bedroom line is not miscounted as beds.
 *
 * @param sub - The sub-description block, or null/undefined.
 * @returns The parsed capacity figures (absent keys when not found).
 */
function parseSubDescriptionItems(sub: AirbnbSubDescription | null | undefined): ParsedCapacity {
    const items = sub?.items;
    if (!Array.isArray(items)) return {};
    const out: ParsedCapacity = {};
    for (const item of items) {
        if (typeof item !== 'string') continue;
        const match = /(\d+(?:[.,]\d+)?)\s*(.+)/.exec(item.trim());
        if (!match?.[1] || !match[2]) continue;
        const n = Number(match[1].replace(',', '.'));
        if (!Number.isFinite(n)) continue;
        const label = match[2].toLowerCase();
        if (/bedroom|habitaci|dormitor|quarto/.test(label)) {
            out.bedrooms ??= n;
        } else if (/bath|baño|bano|banheiro/.test(label)) {
            out.bathrooms ??= n;
        } else if (/bed|cama/.test(label)) {
            out.beds ??= n;
        } else if (/guest|hu[ée]sped|h[óo]spede/.test(label)) {
            out.capacity ??= n;
        }
    }
    return out;
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
        summary?: RawExtraction['summary'];
        type?: RawExtraction['type'];
        location?: RawExtraction['location'];
        imageUrls?: readonly string[];
        amenityNames?: readonly string[];
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

    // -- summary ---------------------------------------------------------------
    // tri_angle exposes a one-paragraph `metaDescription`; other actors may use
    // `summary`/`publicDescription`.
    const summaryRaw = raw.summary ?? raw.publicDescription ?? raw.metaDescription;
    if (summaryRaw) {
        result.summary = { value: summaryRaw, source: 'official_api' };
    }

    // -- type ------------------------------------------------------------------
    // Prefer propertyType ("Entire cottage" / "casa de campo") — it is more
    // specific than roomType ("Entire home/apt") and maps better to the enum.
    const typeRaw = raw.propertyType ?? raw.roomType;
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
    // tri_angle exposes a single `location` string (e.g. "Concepción del Uruguay").
    const locality = raw.location ?? raw.address ?? raw.localizedCity ?? raw.city;
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

    // -- amenityNames ----------------------------------------------------------
    const amenityNames = extractAmenityNames(raw.amenities);
    if (amenityNames.length > 0) {
        result.amenityNames = amenityNames;
    }

    // -- extraInfo (capacity, bedrooms, bathrooms, beds) -----------------------
    // tri_angle has no top-level capacity fields; they live in
    // subDescription.items ("11 guests / 3 bedrooms / 8 beds / 1 bath"). Prefer
    // explicit top-level fields, fall back to the parsed sub-description line.
    const parsedCapacity = parseSubDescriptionItems(raw.subDescription);
    const toFiniteNumber = (v: number | string | null | undefined): number | null => {
        if (v == null) return null;
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const capacity =
        toFiniteNumber(raw.personCapacity ?? raw.guests) ?? parsedCapacity.capacity ?? null;
    const bedrooms = toFiniteNumber(raw.bedrooms) ?? parsedCapacity.bedrooms ?? null;
    const bathrooms = toFiniteNumber(raw.bathrooms) ?? parsedCapacity.bathrooms ?? null;
    const beds = toFiniteNumber(raw.beds) ?? parsedCapacity.beds ?? null;

    const hasCapacity = capacity !== null && Number.isFinite(capacity);
    const hasBedrooms = bedrooms !== null && Number.isFinite(bedrooms);
    const hasBathrooms = bathrooms !== null && Number.isFinite(bathrooms);
    const hasBeds = beds !== null && Number.isFinite(beds);

    if (hasCapacity || hasBedrooms || hasBathrooms || hasBeds) {
        result.extraInfo = {
            ...(hasCapacity
                ? { capacity: { value: capacity, source: 'official_api' as const } }
                : {}),
            ...(hasBedrooms
                ? { bedrooms: { value: bedrooms, source: 'official_api' as const } }
                : {}),
            ...(hasBathrooms
                ? { bathrooms: { value: bathrooms, source: 'official_api' as const } }
                : {}),
            ...(hasBeds ? { beds: { value: beds, source: 'official_api' as const } } : {})
        };
    }

    // -- price (per-night orientative "from" figure — SPEC-258) ---------------
    // The actor is called with check-in/check-out dates so it can return real
    // pricing. We derive a per-night figure and store it as an orientative
    // "from" price. Tagged `source: 'text'` (→ 50% confidence via
    // CONFIDENCE_BY_SOURCE) because this is a date-specific parsed estimate,
    // NOT the listing's authoritative base price. Signals "plausible, requires
    // host review" to the downstream mapping pipeline.
    const perNightPrice =
        extractPerNightPrice(raw.price, PRICE_PROBE_NIGHTS) ??
        extractPerNightPrice(raw.pricing ?? null, PRICE_PROBE_NIGHTS);
    if (perNightPrice !== null) {
        result.price = {
            price: { value: perNightPrice, source: 'text' as const },
            currency: { value: PRICE_PROBE_CURRENCY, source: 'text' as const }
        };
    }

    return result;
}

// ---------------------------------------------------------------------------
// Locale helper
// ---------------------------------------------------------------------------

/**
 * Maps the app locale to the `locale` value the Apify actor expects as INPUT
 * (SPEC-257 piece D). The actor returns the listing content in that language.
 *
 * NOTE: the locale MUST be passed as an actor input field, NOT appended to the
 * listing URL as `?locale=` — a `?locale=` query param breaks the tri_angle
 * actor (it returns an empty dataset). Verified in the SPEC-257 smoke:
 * `{ startUrls, locale: 'es-AR' }` returns Spanish content.
 *
 * @param locale - BCP-47 locale code from {@link ImportContext.locale}.
 * @returns The actor locale code, or `undefined` when no locale is provided.
 */
function mapAirbnbActorLocale(locale: string | undefined): string | undefined {
    if (!locale) return undefined;
    const base = locale.toLowerCase().split('-')[0];
    if (base === 'es') return 'es-AR';
    if (base === 'pt') return 'pt-BR';
    if (base === 'en') return 'en';
    return locale;
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
        // actorInput shape: { startUrls: [{ url }], locale?, checkIn, checkOut,
        // adults, currency } — standard convention for tri_angle actors.
        // checkIn/checkOut are YYYY-MM-DD strings computed dynamically so the
        // actor returns real pricing data (SPEC-258 price probe).
        // -------------------------------------------------------------------
        const actorLocale = mapAirbnbActorLocale(ctx.locale);
        const { checkIn, checkOut } = buildPriceProbeDates();
        const dataset = await runApifyActor({
            token,
            actor,
            actorInput: {
                startUrls: [{ url: url.href }],
                ...(actorLocale ? { locale: actorLocale } : {}),
                checkIn,
                checkOut,
                adults: PRICE_PROBE_ADULTS,
                currency: PRICE_PROBE_CURRENCY
            },
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
