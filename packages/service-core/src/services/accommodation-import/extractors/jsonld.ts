/**
 * JSON-LD Extractor (SPEC-222)
 *
 * Extracts structured lodging data from `<script type="application/ld+json">`
 * blocks embedded in raw HTML.  Uses regex + JSON.parse only — no DOM parser,
 * no cheerio, no jsdom.
 *
 * **Hard rule (SPEC-222)**: rating and review fields are NEVER present in the
 * returned result.  `aggregateRating`, `review`, `ratingValue`, `reviewCount`,
 * `bestRating`, and `worstRating` are stripped before this function returns,
 * even if the source JSON-LD node contained them.
 *
 * @module services/accommodation-import/extractors/jsonld
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Schema.org `@type` values that represent lodging-relevant entities.
 * Only nodes whose `@type` is in this set (or an array containing one of
 * these values) are considered matches.
 */
const LODGING_TYPES = new Set([
    'LodgingBusiness',
    'Hotel',
    'Motel',
    'Hostel',
    'BedAndBreakfast',
    'Resort',
    'Apartment',
    'House',
    'VacationRental',
    'Campground',
    'Place',
    'LocalBusiness'
]);

/**
 * Field names that must never appear in the extracted result.
 * Enforced by {@link stripRatingFields}.
 */
const RATING_FIELDS = new Set([
    'aggregateRating',
    'review',
    'reviews',
    'ratingValue',
    'reviewCount',
    'ratingCount',
    'bestRating',
    'worstRating',
    'starRating'
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * PostalAddress as represented inside a JSON-LD node.
 */
interface JsonLdAddress {
    readonly '@type'?: string;
    readonly streetAddress?: string;
    readonly addressLocality?: string;
    readonly addressCountry?: string;
    readonly addressRegion?: string;
    readonly postalCode?: string;
}

/**
 * GeoCoordinates as represented inside a JSON-LD node.
 */
interface JsonLdGeo {
    readonly '@type'?: string;
    readonly latitude?: number | string;
    readonly longitude?: number | string;
}

/**
 * A loose representation of a raw JSON-LD node before extraction.
 * Typed as a plain object so we can safely access properties without casts.
 */
type JsonLdNode = Record<string, unknown>;

/**
 * Parsed address fields pulled from a PostalAddress JSON-LD node.
 */
export interface JsonLdAddressResult {
    /** Street name and number (from `streetAddress`). */
    readonly streetAddress?: string;
    /** City or locality (from `addressLocality`). */
    readonly addressLocality?: string;
    /** Country name or ISO code (from `addressCountry`). */
    readonly addressCountry?: string;
}

/**
 * Parsed geographic coordinates from a GeoCoordinates JSON-LD node.
 */
export interface JsonLdGeoResult {
    /** Decimal latitude as a string (for compatibility with CoordinatesSchema). */
    readonly latitude: string;
    /** Decimal longitude as a string (for compatibility with CoordinatesSchema). */
    readonly longitude: string;
}

/**
 * The result bag returned by {@link extractJsonLd}.
 *
 * All fields are optional — a node may not carry every property.
 * Source is always `'jsonld'`; the caller does NOT need to tag it separately.
 * Rating and review data are explicitly absent (SPEC-222 hard rule).
 *
 * Advisory collections (`imageUrls`, `scrapedLocality`, `scrapedCountry`)
 * are lifted to the top level so the adapter can populate `RawExtraction`
 * advisory fields without re-parsing.
 */
export interface JsonLdResult {
    /**
     * Accommodation name from the JSON-LD `name` property.
     * Tagged `source: 'jsonld'` for the caller's mapping step.
     */
    readonly name?: string;

    /**
     * Long-form description from the JSON-LD `description` property.
     * Tagged `source: 'jsonld'` for the caller's mapping step.
     */
    readonly description?: string;

    /**
     * Parsed address fields from the PostalAddress node.
     */
    readonly address?: JsonLdAddressResult;

    /**
     * Parsed geographic coordinates.
     */
    readonly geo?: JsonLdGeoResult;

    /**
     * All image URLs found in `image` (string or array).
     * Also promoted to {@link imageUrls} for the caller's advisory collection.
     */
    readonly imageUrls?: readonly string[];

    /**
     * Phone number from `telephone`.
     */
    readonly telephone?: string;

    /**
     * Canonical URL from `url`.
     */
    readonly url?: string;

    /**
     * Price range string from `priceRange` (e.g. `"$$$"`).
     */
    readonly priceRange?: string;

    /**
     * The matched schema.org `@type` string from the lodging node (e.g.
     * `"Hotel"`, `"Apartment"`, `"BedAndBreakfast"`). Only the first lodging-
     * relevant type is forwarded; arrays are searched left to right.
     *
     * The caller may run this through `mapAccommodationType` to convert it to
     * an `AccommodationTypeEnum` value.
     */
    readonly lodgingType?: string;

    /**
     * Raw locality string lifted from `address.addressLocality`.
     * Convenience alias for `RawExtraction.scrapedLocality`.
     */
    readonly scrapedLocality?: string;

    /**
     * Raw country string lifted from `address.addressCountry`.
     * Convenience alias for `RawExtraction.scrapedCountry`.
     */
    readonly scrapedCountry?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Regex that matches a `<script type="application/ld+json">` block.
 *
 * Design choices:
 * - Uses `[\s\S]*?` (lazy) inside each block so multiple scripts on the same
 *   page are matched as distinct captures, not collapsed into one.
 * - The `gi` flags make the attribute match case-insensitive and find all
 *   occurrences on the page.
 * - The script content is capped at 500 000 characters to prevent runaway
 *   backtracking on adversarial inputs.  Real JSON-LD blocks are far smaller.
 */
const JSONLD_SCRIPT_RE =
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]{0,500000}?)<\/script>/gi;

/**
 * Removes all keys listed in {@link RATING_FIELDS} from a plain object,
 * recursively if the value is itself an object (e.g. `aggregateRating` can be
 * a nested `AggregateRating` node).
 *
 * This function is the enforcement point for the SPEC-222 hard rule.
 *
 * @param node - The JSON-LD node to sanitise (mutated in-place for efficiency).
 * @returns The same object with rating/review keys removed.
 */
function stripRatingFields(node: JsonLdNode): JsonLdNode {
    for (const key of RATING_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
            // We must ensure these keys are entirely absent (not just undefined).
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete (node as Record<string, unknown>)[key];
        }
    }
    return node;
}

/**
 * Determines whether a JSON-LD node is lodging-relevant by inspecting its
 * `@type` property.  Accepts both a plain string and an array of strings.
 *
 * @param node - A parsed JSON-LD object.
 * @returns `true` when the node's type is in {@link LODGING_TYPES}.
 */
function isLodgingNode(node: JsonLdNode): boolean {
    const raw = node['@type'];
    if (typeof raw === 'string') {
        return LODGING_TYPES.has(raw);
    }
    if (Array.isArray(raw)) {
        return raw.some((t) => typeof t === 'string' && LODGING_TYPES.has(t));
    }
    return false;
}

/**
 * Extracts all top-level JSON-LD nodes from a parsed JSON value.
 *
 * Handles three shapes:
 * 1. A single object — wraps it in an array.
 * 2. An array of objects — returns it as-is.
 * 3. An object with a `@graph` array — returns the graph members.
 *
 * Non-object elements and non-array `@graph` values are silently ignored.
 *
 * @param parsed - The result of `JSON.parse` on a JSON-LD script block.
 * @returns Flat array of candidate JSON-LD nodes.
 */
function flattenJsonLd(parsed: unknown): JsonLdNode[] {
    if (parsed === null || typeof parsed !== 'object') {
        return [];
    }

    // Top-level array
    if (Array.isArray(parsed)) {
        return parsed.filter(
            (item): item is JsonLdNode =>
                item !== null && typeof item === 'object' && !Array.isArray(item)
        );
    }

    const obj = parsed as JsonLdNode;

    // @graph wrapper
    const graph = obj['@graph'];
    if (Array.isArray(graph)) {
        return graph.filter(
            (item): item is JsonLdNode =>
                item !== null && typeof item === 'object' && !Array.isArray(item)
        );
    }

    // Single object
    return [obj];
}

/**
 * Coerces an `image` property value (which may be a string, an array, an
 * ImageObject, or an array of ImageObjects) into a plain string array of URLs.
 *
 * @param image - The raw value of the `image` property.
 * @returns An array of URL strings (may be empty).
 */
function normaliseImageUrls(image: unknown): string[] {
    if (typeof image === 'string' && image.length > 0) {
        return [image];
    }

    if (Array.isArray(image)) {
        const urls: string[] = [];
        for (const item of image) {
            if (typeof item === 'string' && item.length > 0) {
                urls.push(item);
            } else if (item !== null && typeof item === 'object') {
                // ImageObject { url: '...' }
                const urlVal = (item as Record<string, unknown>).url;
                if (typeof urlVal === 'string' && urlVal.length > 0) {
                    urls.push(urlVal);
                }
            }
        }
        return urls;
    }

    // ImageObject { url: '...' }
    if (image !== null && typeof image === 'object') {
        const urlVal = (image as Record<string, unknown>).url;
        if (typeof urlVal === 'string' && urlVal.length > 0) {
            return [urlVal];
        }
    }

    return [];
}

/**
 * Mutable build-time version of {@link JsonLdAddressResult} used only during
 * construction inside {@link parseAddress}.
 */
interface MutableAddress {
    streetAddress?: string;
    addressLocality?: string;
    addressCountry?: string;
}

/**
 * Parses a PostalAddress node into a typed result.
 *
 * @param raw - The raw value of the `address` property.
 * @returns Parsed address or `undefined` when the input is not an address node.
 */
function parseAddress(raw: unknown): JsonLdAddressResult | undefined {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return undefined;
    }

    const addr = raw as JsonLdAddress;
    const result: MutableAddress = {};

    if (typeof addr.streetAddress === 'string' && addr.streetAddress.length > 0) {
        result.streetAddress = addr.streetAddress;
    }
    if (typeof addr.addressLocality === 'string' && addr.addressLocality.length > 0) {
        result.addressLocality = addr.addressLocality;
    }
    if (typeof addr.addressCountry === 'string' && addr.addressCountry.length > 0) {
        result.addressCountry = addr.addressCountry;
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parses a GeoCoordinates node into a typed result.
 *
 * Both `latitude` and `longitude` must be present and coercible to finite
 * numbers for the result to be returned.
 *
 * @param raw - The raw value of the `geo` property.
 * @returns Parsed coordinates (as strings) or `undefined`.
 */
function parseGeo(raw: unknown): JsonLdGeoResult | undefined {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return undefined;
    }

    const geo = raw as JsonLdGeo;
    const lat = Number(geo.latitude);
    const lon = Number(geo.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return undefined;
    }

    return {
        latitude: String(geo.latitude),
        longitude: String(geo.longitude)
    };
}

/**
 * Mutable build-time version of {@link JsonLdResult} used only during
 * construction inside {@link mapNodeToResult}.
 */
interface MutableJsonLdResult {
    name?: string;
    description?: string;
    address?: JsonLdAddressResult;
    geo?: JsonLdGeoResult;
    imageUrls?: string[];
    telephone?: string;
    url?: string;
    priceRange?: string;
    lodgingType?: string;
    scrapedLocality?: string;
    scrapedCountry?: string;
}

/**
 * Maps a lodging-relevant JSON-LD node into a {@link JsonLdResult}.
 * Strips rating/review fields before returning.
 *
 * @param node - A JSON-LD node that passed the {@link isLodgingNode} check.
 * @returns Extracted result bag (all fields optional).
 */
function mapNodeToResult(node: JsonLdNode): JsonLdResult {
    // Enforce the SPEC-222 hard rule first.
    stripRatingFields(node);

    const result: MutableJsonLdResult = {};

    // name
    if (typeof node.name === 'string' && node.name.length > 0) {
        result.name = node.name;
    }

    // description
    if (typeof node.description === 'string' && node.description.length > 0) {
        result.description = node.description;
    }

    // address
    const addr = parseAddress(node.address);
    if (addr !== undefined) {
        result.address = addr;
        if (addr.addressLocality !== undefined) {
            result.scrapedLocality = addr.addressLocality;
        }
        if (addr.addressCountry !== undefined) {
            result.scrapedCountry = addr.addressCountry;
        }
    }

    // geo
    const geo = parseGeo(node.geo);
    if (geo !== undefined) {
        result.geo = geo;
    }

    // image / imageUrls
    const images = normaliseImageUrls(node.image);
    if (images.length > 0) {
        result.imageUrls = images;
    }

    // telephone
    if (typeof node.telephone === 'string' && node.telephone.length > 0) {
        result.telephone = node.telephone;
    }

    // url
    if (typeof node.url === 'string' && node.url.length > 0) {
        result.url = node.url;
    }

    // priceRange
    if (typeof node.priceRange === 'string' && node.priceRange.length > 0) {
        result.priceRange = node.priceRange;
    }

    // lodgingType — forward the matched @type string so the adapter can map
    // it to an AccommodationTypeEnum via mapAccommodationType. We only forward
    // a type that is already confirmed by isLodgingNode (the caller guarantees
    // this node passed that check). Pick the first lodging-relevant type found.
    const rawType = node['@type'];
    if (typeof rawType === 'string' && LODGING_TYPES.has(rawType)) {
        result.lodgingType = rawType;
    } else if (Array.isArray(rawType)) {
        for (const t of rawType) {
            if (typeof t === 'string' && LODGING_TYPES.has(t)) {
                result.lodgingType = t;
                break;
            }
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts structured lodging data from all `<script type="application/ld+json">`
 * blocks present in the given raw HTML.
 *
 * **Extraction pipeline:**
 * 1. Find every JSON-LD script block via a bounded regex.
 * 2. `JSON.parse` each block independently — malformed blocks are skipped, no throw.
 * 3. Flatten each parsed value to a list of candidate nodes (handles single object,
 *    array, and `@graph` wrapper shapes).
 * 4. Filter to the first node whose `@type` is in the lodging-relevant set.
 * 5. Strip all rating/review fields (SPEC-222 hard rule).
 * 6. Map to a typed {@link JsonLdResult}.
 *
 * If no lodging-relevant node is found across all blocks, returns an empty object.
 * This function never throws.
 *
 * **Rating/review guarantee (SPEC-222):** `aggregateRating`, `review`, `reviews`,
 * `ratingValue`, `reviewCount`, `ratingCount`, `bestRating`, `worstRating`, and
 * `starRating` are stripped before the result is returned.  The caller can rely on
 * their complete absence.
 *
 * @param input - Object containing the raw HTML string to parse.
 * @returns A partial bag of extracted lodging fields. All fields are optional.
 *
 * @example
 * ```ts
 * const result = extractJsonLd({ html: pageHtml });
 * if (result.name) {
 *   console.log('Name:', result.name);
 * }
 * ```
 */
export function extractJsonLd(input: { readonly html: string }): JsonLdResult {
    const { html } = input;

    // Reset lastIndex so the regex is re-entrant across calls.
    JSONLD_SCRIPT_RE.lastIndex = 0;

    // Iterate all JSON-LD script blocks. We avoid assigning inside the while
    // condition (biome noAssignInExpressions) by calling exec and breaking.
    for (;;) {
        const match = JSONLD_SCRIPT_RE.exec(html);
        if (match === null) {
            break;
        }

        const rawJson = match[1];
        if (rawJson === undefined || rawJson.trim().length === 0) {
            continue;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(rawJson);
        } catch {
            // Malformed JSON — skip this block, continue to next.
            continue;
        }

        const nodes = flattenJsonLd(parsed);

        for (const node of nodes) {
            if (isLodgingNode(node)) {
                return mapNodeToResult(node);
            }
        }
    }

    // No lodging node found in any block.
    return {};
}
