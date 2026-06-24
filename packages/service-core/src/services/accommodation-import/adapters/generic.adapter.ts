/**
 * Generic Import Adapter (SPEC-222 T-014)
 *
 * Universal fallback adapter that handles any HTTPS URL not claimed by a
 * platform-specific adapter. Uses the SSRF-hardened `safeExternalFetch` to
 * retrieve the page, runs the structured JSON-LD and Open Graph extractors,
 * and falls back to AI-assisted extraction (Strategy B) via the injected
 * `ctx.aiExtract` port when the structured pass yields too few fields.
 *
 * **Strategy B threshold**: when fewer than {@link STRATEGY_B_THRESHOLD}
 * useful draft-mirroring fields are found in the structured pass AND
 * `ctx.aiExtract` is provided, the stripped page text is sent to the AI port.
 * AI fields are merged into gaps only — structured results always win.
 *
 * **Hard rule (SPEC-222)**: Reviews and ratings MUST NEVER appear in the
 * returned `RawExtraction`. The structured extractors already enforce this;
 * the adapter does not re-introduce any such fields.
 *
 * @module services/accommodation-import/adapters/generic
 */

import { safeExternalFetch } from '@repo/utils/safe-fetch';
import type { ImportContext, ImportSourceAdapter, RawExtraction } from '../adapter.types.js';
import { extractJsonLd } from '../extractors/jsonld.js';
import { extractOpenGraph, stripHtmlToText } from '../extractors/meta.js';
import { mapAccommodationType } from '../mapping.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum number of useful draft-mirroring candidate fields that must be
 * present in the structured extraction result before Strategy B (AI fallback)
 * is skipped. When the count is strictly less than this value AND
 * `ctx.aiExtract` is defined, AI extraction is triggered to fill the gaps.
 *
 * "Useful" means one of: `name`, `summary`, `description`, `type`,
 * `location.coordinates`, `location.street`, `price.price`, `price.currency`,
 * `contactInfo.mobilePhone`, `contactInfo.website`, `extraInfo.capacity`,
 * `extraInfo.bedrooms`, `extraInfo.beds`, `extraInfo.bathrooms`.
 * Advisory arrays (`imageUrls`, `amenityNames`, `scrapedLocality`,
 * `scrapedCountry`) are NOT counted.
 */
export const STRATEGY_B_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Counts the number of useful draft-mirroring candidate fields populated in a
 * partial `RawExtraction`. Advisory collections are explicitly excluded from
 * the count per the SPEC-222 threshold definition.
 *
 * @param extraction - The partial extraction to inspect.
 * @returns Integer count of populated useful fields.
 */
function countUsefulFields(extraction: Partial<RawExtraction>): number {
    let count = 0;

    if (extraction.name !== undefined) count++;
    if (extraction.summary !== undefined) count++;
    if (extraction.description !== undefined) count++;
    if (extraction.type !== undefined) count++;

    if (extraction.location !== undefined) {
        if (extraction.location.coordinates !== undefined) count++;
        if (extraction.location.street !== undefined) count++;
    }

    if (extraction.price !== undefined) {
        if (extraction.price.price !== undefined) count++;
        if (extraction.price.currency !== undefined) count++;
    }

    if (extraction.contactInfo !== undefined) {
        if (extraction.contactInfo.mobilePhone !== undefined) count++;
        if (extraction.contactInfo.website !== undefined) count++;
    }

    if (extraction.extraInfo !== undefined) {
        if (extraction.extraInfo.capacity !== undefined) count++;
        if (extraction.extraInfo.bedrooms !== undefined) count++;
        if (extraction.extraInfo.beds !== undefined) count++;
        if (extraction.extraInfo.bathrooms !== undefined) count++;
    }

    return count;
}

/**
 * Attempts to parse a numeric price value from a JSON-LD `priceRange` string.
 *
 * Only strings that contain a parseable positive number are accepted. Non-numeric
 * band strings like `"$$"` or `"$$$"` (common on Yelp-style sites) are rejected
 * and return `undefined` so that no price candidate is emitted.
 *
 * Parsing strategy:
 * - Strip common currency symbols/codes and whitespace (`$`, `€`, `£`, `¥`, `ARS`).
 * - Remove thousands separators, then accept ONLY a clean number (optional 1-2
 *   decimal places). Ambiguous inputs (ranges, European format) are rejected.
 * - Reject NaN, negative values, and zero.
 *
 * @param priceRange - The raw `priceRange` string from a JSON-LD node.
 * @returns A positive finite number if a price was parsed, `undefined` otherwise.
 */
function parsePriceFromRange(priceRange: string): number | undefined {
    // Strip currency symbols and known currency codes, then trim.
    const stripped = priceRange.replace(/[€£¥]|ARS|USD|EUR|\$/gi, '').trim();

    // Reject empty strings and pure symbol bands (e.g. "$$", "$$$$") that
    // produce an empty string after stripping. These have no numeric value.
    if (stripped.length === 0) {
        return undefined;
    }

    // Remove thousands separators (commas) so "1,200" -> "1200", then accept ONLY
    // a clean number with an optional 1-2 digit decimal. Anything ambiguous — a
    // range ("120-200"), a European-format value ("1.200,50"), or any leftover
    // non-numeric character — is rejected rather than mis-parsed. This matters:
    // Number.parseFloat("1,200") silently yields 1 (a wrong price), which is worse
    // than leaving it unset (under-resolve > mis-resolve).
    const normalized = stripped.replace(/,/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
        return undefined;
    }

    const n = Number.parseFloat(normalized);

    if (!Number.isFinite(n) || n <= 0) {
        return undefined;
    }

    return n;
}

/**
 * Merges AI-extracted fields into `base`, filling only fields that `base`
 * does NOT already provide. Structured results always win over AI results.
 *
 * Both `base` and `ai` must have `sourcePlatform: 'generic'` — the returned
 * object preserves `'generic'` as the platform and the AI candidate fields
 * retain their `source: 'ai'` tag.
 *
 * @param base - The structured extraction result (may have partial fields).
 * @param ai - The AI-extracted result with `source: 'ai'` tagged fields.
 * @returns A new `RawExtraction` with AI fields merged into gaps only.
 */
function mergeAiIntoGaps(base: RawExtraction, ai: RawExtraction): RawExtraction {
    return {
        sourcePlatform: 'generic',

        // Draft-mirroring scalar fields — structured wins; AI fills gaps.
        name: base.name ?? ai.name,
        summary: base.summary ?? ai.summary,
        description: base.description ?? ai.description,
        type: base.type ?? ai.type,

        // Nested location — merge at sub-field level so a partial structured
        // location does not block AI from filling missing sub-fields.
        location:
            base.location !== undefined || ai.location !== undefined
                ? {
                      coordinates: base.location?.coordinates ?? ai.location?.coordinates,
                      street: base.location?.street ?? ai.location?.street,
                      number: base.location?.number ?? ai.location?.number
                  }
                : undefined,

        // Nested price
        price:
            base.price !== undefined || ai.price !== undefined
                ? {
                      price: base.price?.price ?? ai.price?.price,
                      currency: base.price?.currency ?? ai.price?.currency
                  }
                : undefined,

        // Nested contactInfo
        contactInfo:
            base.contactInfo !== undefined || ai.contactInfo !== undefined
                ? {
                      mobilePhone: base.contactInfo?.mobilePhone ?? ai.contactInfo?.mobilePhone,
                      website: base.contactInfo?.website ?? ai.contactInfo?.website
                  }
                : undefined,

        // Nested extraInfo
        extraInfo:
            base.extraInfo !== undefined || ai.extraInfo !== undefined
                ? {
                      capacity: base.extraInfo?.capacity ?? ai.extraInfo?.capacity,
                      bedrooms: base.extraInfo?.bedrooms ?? ai.extraInfo?.bedrooms,
                      beds: base.extraInfo?.beds ?? ai.extraInfo?.beds,
                      bathrooms: base.extraInfo?.bathrooms ?? ai.extraInfo?.bathrooms
                  }
                : undefined,

        // Nested seo
        seo:
            base.seo !== undefined || ai.seo !== undefined
                ? {
                      title: base.seo?.title ?? ai.seo?.title,
                      description: base.seo?.description ?? ai.seo?.description
                  }
                : undefined,

        // Advisory collections — prefer structured; AI fills if absent.
        imageUrls:
            base.imageUrls !== undefined && base.imageUrls.length > 0
                ? base.imageUrls
                : (ai.imageUrls ?? base.imageUrls),
        amenityNames:
            base.amenityNames !== undefined && base.amenityNames.length > 0
                ? base.amenityNames
                : (ai.amenityNames ?? base.amenityNames),
        scrapedLocality: base.scrapedLocality ?? ai.scrapedLocality,
        scrapedCountry: base.scrapedCountry ?? ai.scrapedCountry
    };
}

// ---------------------------------------------------------------------------
// GenericAdapter
// ---------------------------------------------------------------------------

/**
 * Universal fallback import adapter that handles any HTTPS URL.
 *
 * The orchestrator registers this adapter last so it only runs when no
 * platform-specific adapter claims the URL. It uses two extraction strategies:
 *
 * **Strategy A (Structured)**: Runs `extractJsonLd` and `extractOpenGraph`
 * on the fetched HTML. JSON-LD results take precedence over Open Graph results
 * when both provide the same field (higher confidence signal).
 *
 * **Strategy B (AI fallback)**: When Strategy A yields fewer than
 * {@link STRATEGY_B_THRESHOLD} useful draft-mirroring fields AND
 * `ctx.aiExtract` is provided, the page text is stripped (via
 * `stripHtmlToText`) and forwarded to the AI port. AI results only fill gaps
 * left by Strategy A — structured results are never overwritten by AI.
 *
 * If `ctx.aiExtract` is absent (AI feature disabled or unconfigured),
 * Strategy B is skipped and the structured partial is returned as-is.
 * If `ctx.aiExtract` throws, the error is swallowed and the structured partial
 * is returned — AI is best-effort, never load-bearing.
 *
 * @implements {ImportSourceAdapter}
 */
export class GenericAdapter implements ImportSourceAdapter {
    /**
     * Platform identifier for this adapter.
     * The orchestrator uses this to populate `AccommodationImportResponse.source`.
     */
    readonly source = 'generic' as const;

    /**
     * Returns `true` for any HTTP(S) URL. This adapter is the universal fallback
     * and must only be registered last in the orchestrator's adapter list, so it
     * accepts any web URL the earlier platform adapters did not claim. The
     * HTTPS-only network policy is enforced downstream by `safeExternalFetch`
     * (a plain `http:` URL reaches `extract` but is blocked at fetch time and
     * degrades to an empty extraction), so routing stays honest — the catch-all
     * never reports "unsupported" for a URL it is the last resort for.
     *
     * @param url - The parsed URL of the listing to import.
     * @returns `true` for any `http:`/`https:` URL; `false` for other schemes.
     *
     * @example
     * ```ts
     * adapter.supports(new URL('https://example.com/listing/123')); // true
     * adapter.supports(new URL('http://example.com/listing/123'));  // true (blocked later by safeExternalFetch)
     * ```
     */
    supports(url: URL): boolean {
        return url.protocol === 'https:' || url.protocol === 'http:';
    }

    /**
     * Extracts accommodation field candidates from a generic HTTPS URL.
     *
     * **Pipeline:**
     * 1. Fetch the page via `safeExternalFetch` (SSRF-hardened). On block or
     *    failure, return `{ sourcePlatform: 'generic' }` — never throw.
     * 2. Run `extractJsonLd` + `extractOpenGraph` on the HTML body.
     * 3. Merge their outputs into a `RawExtraction`: JSON-LD fields take
     *    precedence, tagged `source: 'jsonld'`; Open Graph fields fill gaps,
     *    tagged `source: 'opengraph'`; the plain meta-description is tagged
     *    `source: 'meta'`.
     * 4. Count useful draft-mirroring fields. If fewer than
     *    {@link STRATEGY_B_THRESHOLD} are found AND `ctx.aiExtract` is
     *    defined, strip the page to plain text and call the AI port.
     * 5. Merge AI results into gaps (structured always wins). On AI error,
     *    return the structured partial without throwing.
     *
     * **Hard rule (SPEC-222)**: The returned `RawExtraction` MUST NOT contain
     * review or rating data. The structured extractors already enforce this.
     *
     * @param url - The parsed URL of the listing to import.
     * @param ctx - Per-request context: locale, limits, credentials, AI port.
     * @returns A loose bag of candidate field values ready for mapping.
     */
    async extract(url: URL, ctx: ImportContext): Promise<RawExtraction> {
        // Step 1: Fetch the page (SSRF-safe).
        const res = await safeExternalFetch({
            url: url.href,
            timeoutMs: ctx.timeoutMs,
            maxBytes: ctx.maxBytes
        });

        if (!res.ok) {
            // Blocked or failed — degrade gracefully, never throw.
            return { sourcePlatform: 'generic' };
        }

        const { body: html } = res;

        // Step 2: Run structured extractors.
        const jsonld = extractJsonLd({ html });
        const og = extractOpenGraph({ html });

        // Step 3: Merge JSON-LD and OG into a RawExtraction.
        // JSON-LD wins over OG when both provide the same field.
        const structured = this._buildStructuredExtraction(jsonld, og);

        // Step 4: Check whether Strategy B is needed.
        const usefulCount = countUsefulFields(structured);

        if (usefulCount >= STRATEGY_B_THRESHOLD || ctx.aiExtract === undefined) {
            return structured;
        }

        // Step 5: Strategy B — AI-assisted extraction.
        try {
            const text = stripHtmlToText({ html, maxChars: ctx.aiMaxChars });
            const ai = await ctx.aiExtract({ text, locale: ctx.locale });

            if (ai === null) {
                // AI produced nothing usable — return structured partial.
                return structured;
            }

            return mergeAiIntoGaps(structured, ai);
        } catch {
            // AI errors are best-effort — keep structured partial, never throw.
            return structured;
        }
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Merges the outputs of `extractJsonLd` and `extractOpenGraph` into a
     * typed `RawExtraction`. JSON-LD fields take precedence; OG/meta fill gaps.
     *
     * @param jsonld - Result from `extractJsonLd`.
     * @param og - Result from `extractOpenGraph`.
     * @returns A partial `RawExtraction` with `sourcePlatform: 'generic'`.
     */
    private _buildStructuredExtraction(
        jsonld: ReturnType<typeof extractJsonLd>,
        og: ReturnType<typeof extractOpenGraph>
    ): RawExtraction {
        // name: JSON-LD `name` wins; fall back to OG `og:title`.
        const name =
            jsonld.name !== undefined
                ? { value: jsonld.name, source: 'jsonld' as const }
                : og.title !== undefined
                  ? { value: og.title.value, source: 'opengraph' as const }
                  : undefined;

        // description: JSON-LD `description` wins; fall back to OG description,
        // then plain meta description.
        const description =
            jsonld.description !== undefined
                ? { value: jsonld.description, source: 'jsonld' as const }
                : og.ogDescription !== undefined
                  ? { value: og.ogDescription.value, source: 'opengraph' as const }
                  : og.metaDescription !== undefined
                    ? { value: og.metaDescription.value, source: 'meta' as const }
                    : undefined;

        // summary: use OG description as summary when JSON-LD already fills
        // `description` with the long-form text — keeps the two fields distinct.
        // When JSON-LD does not provide a description, the OG description is used
        // for `description` (above); in that case `summary` is left undefined.
        const summary =
            jsonld.description !== undefined && og.ogDescription !== undefined
                ? { value: og.ogDescription.value, source: 'opengraph' as const }
                : undefined;

        // location: prefer JSON-LD geo + address; supplement with OG geo.position.
        let locationCoordinates:
            | { readonly value: unknown; readonly source: 'jsonld' | 'meta' }
            | undefined;

        if (jsonld.geo !== undefined) {
            locationCoordinates = {
                value: { lat: jsonld.geo.latitude, long: jsonld.geo.longitude },
                source: 'jsonld' as const
            };
        } else if (og.geoPosition !== undefined) {
            locationCoordinates = {
                value: { lat: og.geoPosition.lat, long: og.geoPosition.long },
                source: 'meta' as const
            };
        }

        const locationStreet =
            jsonld.address?.streetAddress !== undefined
                ? { value: jsonld.address.streetAddress, source: 'jsonld' as const }
                : undefined;

        const location =
            locationCoordinates !== undefined || locationStreet !== undefined
                ? { coordinates: locationCoordinates, street: locationStreet }
                : undefined;

        // contactInfo: telephone from JSON-LD; website from JSON-LD url or OG url.
        const mobilePhone =
            jsonld.telephone !== undefined
                ? { value: jsonld.telephone, source: 'jsonld' as const }
                : undefined;

        const website =
            jsonld.url !== undefined
                ? { value: jsonld.url, source: 'jsonld' as const }
                : og.ogUrl !== undefined
                  ? { value: og.ogUrl.value, source: 'opengraph' as const }
                  : undefined;

        const contactInfo =
            mobilePhone !== undefined || website !== undefined
                ? { mobilePhone, website }
                : undefined;

        // Advisory collections.
        // imageUrls: JSON-LD image array; supplement with OG image if absent.
        let imageUrls: readonly string[] | undefined;
        if (jsonld.imageUrls !== undefined && jsonld.imageUrls.length > 0) {
            imageUrls = jsonld.imageUrls;
        } else if (og.image !== undefined) {
            imageUrls = [og.image.value];
        }

        const scrapedLocality = jsonld.scrapedLocality;
        const scrapedCountry = jsonld.scrapedCountry;

        // type: forward JSON-LD @type through the accommodation type heuristic.
        // Only set when a confident mapping is found; leave unset otherwise so
        // the host can pick the type manually without a wrong prefill.
        const type =
            jsonld.lodgingType !== undefined
                ? (() => {
                      const mapped = mapAccommodationType(jsonld.lodgingType);
                      return mapped !== undefined
                          ? { value: mapped, source: 'jsonld' as const }
                          : undefined;
                  })()
                : undefined;

        // price.price: parse a numeric value from JSON-LD priceRange.
        // Non-numeric band strings (e.g. "$$", "$$$") are rejected — only real
        // numbers produce a candidate so the host is not misled.
        const pricePrice =
            jsonld.priceRange !== undefined
                ? (() => {
                      const n = parsePriceFromRange(jsonld.priceRange);
                      return n !== undefined ? { value: n, source: 'jsonld' as const } : undefined;
                  })()
                : undefined;

        const price = pricePrice !== undefined ? { price: pricePrice } : undefined;

        return {
            sourcePlatform: 'generic',
            ...(name !== undefined && { name }),
            ...(summary !== undefined && { summary }),
            ...(description !== undefined && { description }),
            ...(type !== undefined && { type }),
            ...(location !== undefined && { location }),
            ...(price !== undefined && { price }),
            ...(contactInfo !== undefined && { contactInfo }),
            ...(imageUrls !== undefined && { imageUrls }),
            ...(scrapedLocality !== undefined && { scrapedLocality }),
            ...(scrapedCountry !== undefined && { scrapedCountry })
        };
    }
}
