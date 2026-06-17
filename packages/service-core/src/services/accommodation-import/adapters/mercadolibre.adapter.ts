/**
 * MercadoLibre Import Adapter (SPEC-222 T-017)
 *
 * Implements the {@link ImportSourceAdapter} contract for MercadoLibre and
 * MercadoLivre listing URLs (any country TLD). Calls the official ML Items API
 * (`https://api.mercadolibre.com/items/{id}`) with a Bearer token from the
 * import context credentials.
 *
 * **Credential degradation (US-11):** when `ctx.credentials.mercadoLibreToken`
 * is absent or empty the adapter returns an empty extraction immediately — it
 * does NOT throw and does NOT call the API.
 *
 * **Hard rule (SPEC-222):** ratings and review data are never mapped. Only the
 * fields explicitly listed in `mapMlItemToRawExtraction` are extracted.
 *
 * @module services/accommodation-import/adapters/mercadolibre
 */

import type { ImportContext, ImportSourceAdapter, RawExtraction } from '../adapter.types.js';

// ---------------------------------------------------------------------------
// MercadoLibre API response types (only the fields we read)
// ---------------------------------------------------------------------------

/**
 * A single attribute entry from `MlItem.attributes[]`.
 */
interface MlAttribute {
    readonly id: string;
    readonly name: string;
    readonly value_name: string | null;
}

/**
 * City/state/country sub-object inside ML location data.
 */
interface MlLocationNode {
    readonly name?: string | null | undefined;
}

/**
 * Location block as returned by the ML Items API.
 * Both `location` (top-level) and `seller_address` use the same shape.
 */
interface MlLocation {
    readonly city?: MlLocationNode | null | undefined;
    readonly state?: MlLocationNode | null | undefined;
    readonly country?: MlLocationNode | null | undefined;
    readonly latitude?: number | string | null | undefined;
    readonly longitude?: number | string | null | undefined;
}

/**
 * Picture entry from `MlItem.pictures[]`.
 */
interface MlPicture {
    readonly url?: string | null | undefined;
    readonly secure_url?: string | null | undefined;
}

/**
 * The subset of an ML Items API response that this adapter reads.
 *
 * Fields intentionally excluded:
 *   - `seller_reputation`, `reviews`, `rating`, `feedback_*` — SPEC-222 hard rule.
 *   - All fields beyond the explicit list below are ignored at runtime via
 *     the typed interface (TypeScript ignores excess properties).
 */
interface MlItem {
    readonly title?: string | null | undefined;
    readonly price?: number | null | undefined;
    readonly currency_id?: string | null | undefined;
    readonly attributes?: readonly MlAttribute[] | null | undefined;
    readonly location?: MlLocation | null | undefined;
    readonly seller_address?: MlLocation | null | undefined;
    readonly pictures?: readonly MlPicture[] | null | undefined;
}

// ---------------------------------------------------------------------------
// Item ID parsing
// ---------------------------------------------------------------------------

/**
 * Regex that matches a MercadoLibre item ID in any of its forms:
 *
 * - `MLA1234567890`   — packed form (no dash)
 * - `MLA-1234567890` — dashed form (as found in URL paths)
 *
 * The country prefix is 2–3 uppercase letters followed by at least 1 digit.
 * We match greedily and normalise the dash variant by removing the dash.
 */
const ML_ITEM_ID_RE = /\b([A-Z]{2,3})-?(\d+)\b/;

/**
 * Parses a MercadoLibre item ID from a URL.
 *
 * Checks the pathname segments first (most URLs embed the ID there), then
 * falls back to the full URL string. Normalises the dash form (`MLA-123`) to
 * the canonical packed form (`MLA123`).
 *
 * @param url - The parsed listing URL.
 * @returns The normalised item ID (e.g. `MLA1234567890`), or `null` when none
 *   can be found.
 *
 * @example
 * ```ts
 * parseItemId(new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo'))
 * // → 'MLA1234567890'
 * parseItemId(new URL('https://www.mercadolibre.com.ar/p/MLA1234567890'))
 * // → 'MLA1234567890'
 * parseItemId(new URL('https://example.com/not-an-ml-url'))
 * // → null
 * ```
 */
function parseItemId(url: URL): string | null {
    // Try each path segment first
    for (const segment of url.pathname.split('/')) {
        const match = ML_ITEM_ID_RE.exec(segment);
        if (match) {
            // match[1] = prefix (e.g. 'MLA'), match[2] = digits
            return `${match[1]}${match[2]}`;
        }
    }
    // Fallback: scan entire URL string
    const full = ML_ITEM_ID_RE.exec(url.href);
    if (full) {
        return `${full[1]}${full[2]}`;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Response mapper
// ---------------------------------------------------------------------------

/**
 * Attribute IDs recognised as bedroom-count indicators.
 * SPEC-222: only BEDROOMS/ROOMS are mapped.
 */
const BEDROOM_ATTR_IDS = new Set(['BEDROOMS', 'ROOMS']);

/**
 * Attribute IDs recognised as bathroom-count indicators.
 */
const BATHROOM_ATTR_IDS = new Set(['BATHROOMS']);

/**
 * Attribute IDs recognised as capacity indicators.
 */
const CAPACITY_ATTR_IDS = new Set([
    'CAPACITY',
    'MAX_CAPACITY',
    'GUESTS',
    'GUEST_CAPACITY',
    'NUMBER_OF_GUESTS'
]);

/**
 * Safely parses an integer from an attribute `value_name` string.
 * Returns `null` when the string is absent or non-numeric.
 */
function parseAttrInt(value: string | null | undefined): number | null {
    if (!value) return null;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
}

/**
 * Converts a raw ML Items API response into a {@link RawExtraction}.
 *
 * Only maps fields explicitly allowed by SPEC-222 T-017. Rating / review /
 * seller-reputation fields are intentionally absent from the `MlItem` type
 * and are never accessed.
 *
 * @param item - Parsed ML item JSON (already typed to `MlItem`).
 * @returns A {@link RawExtraction} with all mapped fields tagged
 *   `source: 'official_api'`.
 */
function mapMlItemToRawExtraction(item: MlItem): RawExtraction {
    const result: {
        sourcePlatform: 'mercadolibre';
        name?: RawExtraction['name'];
        price?: RawExtraction['price'];
        imageUrls?: readonly string[];
        scrapedLocality?: string;
        scrapedCountry?: string;
        location?: RawExtraction['location'];
        extraInfo?: RawExtraction['extraInfo'];
    } = {
        sourcePlatform: 'mercadolibre'
    };

    // -- name -----------------------------------------------------------------
    if (item.title) {
        result.name = { value: item.title, source: 'official_api' };
    }

    // -- price ----------------------------------------------------------------
    if (item.price != null || item.currency_id) {
        result.price = {
            ...(item.price != null ? { price: { value: item.price, source: 'official_api' } } : {}),
            ...(item.currency_id
                ? { currency: { value: item.currency_id, source: 'official_api' } }
                : {})
        };
    }

    // -- images ---------------------------------------------------------------
    if (item.pictures && item.pictures.length > 0) {
        const urls: string[] = [];
        for (const pic of item.pictures) {
            const u = pic.secure_url ?? pic.url;
            if (u) urls.push(u);
        }
        if (urls.length > 0) {
            result.imageUrls = urls;
        }
    }

    // -- location (prefer top-level `location`, fall back to `seller_address`) --
    const loc = item.location ?? item.seller_address;
    if (loc) {
        const city = loc.city?.name ?? undefined;
        const country = loc.country?.name ?? undefined;

        if (city) result.scrapedLocality = city;
        if (country) result.scrapedCountry = country;

        const lat = loc.latitude;
        const lng = loc.longitude;
        if (lat != null && lng != null) {
            result.location = {
                coordinates: {
                    value: { lat: String(lat), long: String(lng) },
                    source: 'official_api'
                }
            };
        }
    }

    // -- attributes -----------------------------------------------------------
    if (item.attributes && item.attributes.length > 0) {
        let bedrooms: number | null = null;
        let bathrooms: number | null = null;
        let capacity: number | null = null;

        for (const attr of item.attributes) {
            const id = attr.id.toUpperCase();
            if (BEDROOM_ATTR_IDS.has(id)) {
                bedrooms = parseAttrInt(attr.value_name) ?? bedrooms;
            } else if (BATHROOM_ATTR_IDS.has(id)) {
                bathrooms = parseAttrInt(attr.value_name) ?? bathrooms;
            } else if (CAPACITY_ATTR_IDS.has(id)) {
                capacity = parseAttrInt(attr.value_name) ?? capacity;
            }
        }

        const hasExtra = bedrooms !== null || bathrooms !== null || capacity !== null;
        if (hasExtra) {
            result.extraInfo = {
                ...(bedrooms !== null
                    ? { bedrooms: { value: bedrooms, source: 'official_api' } }
                    : {}),
                ...(bathrooms !== null
                    ? { bathrooms: { value: bathrooms, source: 'official_api' } }
                    : {}),
                ...(capacity !== null
                    ? { capacity: { value: capacity, source: 'official_api' } }
                    : {})
            };
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// MercadoLibreAdapter
// ---------------------------------------------------------------------------

/**
 * Import adapter for MercadoLibre and MercadoLivre listing URLs.
 *
 * Handles any country TLD (`.com.ar`, `.com.mx`, `.com.br`, `.com.co`, etc.).
 * Calls the official ML Items REST API with a Bearer token from the import
 * context. Gracefully degrades (returns empty extraction) on:
 *   - missing / empty `mercadoLibreToken` (US-11)
 *   - unrecognisable item ID in the URL
 *   - non-2xx API response
 *   - network / timeout error
 *
 * @example
 * ```ts
 * const adapter = new MercadoLibreAdapter();
 * adapter.supports(new URL('https://articulo.mercadolibre.com.ar/MLA-123-x')); // true
 * adapter.supports(new URL('https://airbnb.com/rooms/1'));                      // false
 * ```
 */
export class MercadoLibreAdapter implements ImportSourceAdapter {
    /** The import source identifier for this adapter. */
    readonly source = 'mercadolibre' as const;

    /**
     * Returns `true` when the URL belongs to a MercadoLibre or MercadoLivre
     * domain (any country TLD).
     *
     * Matches: `articulo.mercadolibre.com.ar`, `mercadolibre.com.mx`,
     * `produto.mercadolivre.com.br`, etc.
     *
     * @param url - The parsed listing URL.
     * @returns `true` if this adapter handles the URL.
     */
    supports(url: URL): boolean {
        const host = url.hostname.toLowerCase();
        return host.includes('mercadolibre.') || host.includes('mercadolivre.');
    }

    /**
     * Extracts raw field candidates from a MercadoLibre listing URL by calling
     * the official ML Items API (`https://api.mercadolibre.com/items/{id}`).
     *
     * **Degradation cases** (returns `{ sourcePlatform: 'mercadolibre' }`, no throw):
     * 1. `ctx.credentials.mercadoLibreToken` is absent or empty (US-11).
     * 2. No recognisable ML item ID can be parsed from the URL.
     * 3. The ML API returns a non-2xx status.
     * 4. `fetch` throws (network error, `AbortController` timeout, etc.).
     *
     * **Hard rule**: rating, review, and seller-reputation fields are NEVER
     * present in the returned extraction (SPEC-222).
     *
     * @param url - The parsed listing URL.
     * @param ctx - Per-request context with credentials and timeout.
     * @returns A {@link RawExtraction} with all mapped fields tagged
     *   `source: 'official_api'`, or an empty extraction on degradation.
     */
    async extract(url: URL, ctx: ImportContext): Promise<RawExtraction> {
        const empty: RawExtraction = { sourcePlatform: 'mercadolibre' };

        // 1. Credential degradation (US-11)
        const token = ctx.credentials.mercadoLibreToken;
        if (!token) {
            return empty;
        }

        // 2. Parse item ID from URL
        const itemId = parseItemId(url);
        if (!itemId) {
            return empty;
        }

        // 3. Call official ML Items API
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);

        let item: MlItem;
        try {
            const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json'
                },
                signal: controller.signal
            });

            if (!response.ok) {
                return empty;
            }

            item = (await response.json()) as MlItem;
        } catch {
            // Network error, AbortError (timeout), JSON parse failure — all degrade
            return empty;
        } finally {
            clearTimeout(timer);
        }

        // 4. Map ML item fields to RawExtraction
        return mapMlItemToRawExtraction(item);
    }
}
