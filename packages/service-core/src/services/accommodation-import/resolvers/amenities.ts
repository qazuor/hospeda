/**
 * Amenity Resolver (SPEC-222 T-012, enhanced SPEC-258, updated SPEC-266 T-003)
 *
 * Resolves scraped amenity strings to Hospeda catalog amenity UUIDs by
 * querying the {@link AmenityService} for each term and applying a two-step
 * matching strategy. Accepts either a catalog slug (e.g. "air_conditioning")
 * or a free-text variant (e.g. "Aire acondicionado") — synonyms bridge the gap.
 *
 * ## Background
 *
 * The JSONB `name` column was dropped from the amenities table in SPEC-266 T-001.
 * Matching now runs against the `slug` column — the single canonical text
 * identifier — instead of the former `name.es` field.
 *
 * ## Matching strategy (in priority order)
 *
 * 1. **Direct normalized match** — normalize the input (lowercase, strip
 *    diacritics, collapse whitespace, simple plural fold) and compare against
 *    the normalized `slug` of each search result. Equality (not substring) is
 *    required, so "pool" never mis-resolves to "heated_pool".
 *
 * 2. **Synonym map lookup** — if step 1 finds nothing, look up the normalized
 *    input in the static {@link AMENITY_SYNONYMS} dictionary. A hit yields a
 *    canonical catalog slug (e.g. "pileta" → "pool"). The resolver then runs a
 *    second `searchForList` call for that slug and applies the same normalized
 *    match against `slug`. This covers regional variants
 *    (pileta/piscina/pool), cross-language synonyms (Wi-Fi/wifi/internet), and
 *    common spelling variants without any fuzzy matching.
 *
 * 3. **Unresolved** — anything that does not pass a confident match in steps 1
 *    or 2 flows to `unresolved` for host review.
 *
 * ## Why we do NOT touch AmenityService
 *
 * The synonym-driven slug lookup reuses the existing `searchForList` path with
 * the `slug` filter (exact-match on the catalog `slug` column). No new
 * `getBySlug` helper was added to `AmenityService` — the search results already
 * carry `slug`, which is all we need for the second-pass match.
 *
 * ## Conservative contract (SPEC-222 AC-9.3)
 *
 * Under-resolve is always preferable to mis-resolve. The host reviews the
 * `unresolved` list and picks the right amenity manually. A wrong auto-
 * resolution would silently associate the wrong amenity — that is worse than
 * leaving it unresolved.
 *
 * @module services/accommodation-import/resolvers/amenities
 */

import type { AmenitySearchForListOutput, AmenitySearchInput } from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import type { AmenityService } from '../../amenity/amenity.service.js';
import { AMENITY_SYNONYMS, normalizeAmenityTerm } from './amenity-synonyms.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Input for {@link resolveAmenities}.
 */
export interface ResolveAmenitiesInput {
    /**
     * Raw amenity name strings scraped from the listing page.
     * May contain duplicates — the resolver de-duplicates before processing.
     */
    readonly names: readonly string[];
    /**
     * AmenityService instance used to query the catalog.
     * The caller is responsible for providing a correctly configured instance.
     */
    readonly amenityService: Pick<AmenityService, 'searchForList'>;
    /**
     * Actor whose permissions are used for the catalog search.
     * Must have AMENITY_VIEW (or equivalent list) permission.
     */
    readonly actor: Actor;
}

/**
 * Output of {@link resolveAmenities}.
 */
export interface ResolveAmenitiesOutput {
    /**
     * De-duplicated list of Hospeda catalog amenity UUIDs that were
     * confidently matched from the input names.
     * Preserves the first-occurrence order of the input names that resolved.
     */
    readonly amenityIds: string[];
    /**
     * Names that could NOT be resolved to a catalog amenity (no match, fuzzy-
     * only match, or lookup error). Advisory only — NEVER applied automatically
     * (SPEC-222 AC-9.3). De-duplicated, preserves input order.
     */
    readonly unresolved: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parameters for a single amenity name lookup.
 *
 * Kept internal — the public surface is {@link ResolveAmenitiesInput}.
 */
interface LookupParams {
    readonly name: string;
    readonly amenityService: Pick<AmenityService, 'searchForList'>;
    readonly actor: Actor;
}

/**
 * Searches the catalog for `searchTerm` and returns the id of the first result
 * whose normalized `slug` exactly equals `normalizedInput`
 * (case/accent/whitespace insensitive).
 *
 * The `slug` is the single canonical text identifier after SPEC-266 dropped the
 * JSONB `name` column.
 *
 * Returns `null` when no confident match exists or when `searchForList` throws.
 *
 * @param searchTerm - The term passed to `searchForList` (may differ from the
 *   original input when doing a synonym-driven slug lookup).
 * @param normalizedInput - Pre-normalized form of the term being matched, used
 *   for the final equality check against the catalog `slug`.
 * @param amenityService - Service instance.
 * @param actor - Actor for permission checks.
 * @returns Matched amenity UUID, or `null`.
 */
async function searchAndMatch(
    searchTerm: string,
    normalizedInput: string,
    amenityService: Pick<AmenityService, 'searchForList'>,
    actor: Actor
): Promise<string | null> {
    let result: AmenitySearchForListOutput;
    try {
        const searchInput: AmenitySearchInput = {
            slug: searchTerm,
            page: 1,
            pageSize: 10
        };
        result = await amenityService.searchForList(actor, searchInput);
    } catch {
        return null;
    }

    // Match against the catalog `slug` — the single canonical text identifier
    // after SPEC-266 T-001 dropped the JSONB `name` column.
    const match = result.data.find(
        (item) => normalizeAmenityTerm(item.slug ?? '') === normalizedInput
    );

    return match?.id ?? null;
}

/**
 * Attempts to resolve a single amenity name to a catalog UUID.
 *
 * Resolution order:
 * 1. Direct search using the original name; match normalized input against the
 *    catalog `slug`.
 * 2. Synonym map lookup: normalize input → canonical slug → search for slug →
 *    match normalized slug against `slug`.
 *
 * Returns `null` when neither step finds a confident match.
 *
 * Errors from `searchForList` are caught here so the caller can push the name
 * to `unresolved` without interrupting the rest of the batch.
 *
 * @param params - Lookup parameters.
 * @returns The matched amenity UUID, or `null` on no match / error.
 */
async function lookupAmenityByName(params: LookupParams): Promise<string | null> {
    const { name, amenityService, actor } = params;
    const trimmedName = name.trim();

    if (trimmedName === '') {
        return null;
    }

    const normalizedInput = normalizeAmenityTerm(trimmedName);

    // Step 1: direct search — look for the original (trimmed) name in the DB and
    // match normalized input against the catalog `slug`.
    const directId = await searchAndMatch(trimmedName, normalizedInput, amenityService, actor);
    if (directId !== null) {
        return directId;
    }

    // Step 2: synonym map — if the normalized input maps to a canonical slug,
    // search for that slug and match the normalized slug against `slug`.
    const canonicalSlug = AMENITY_SYNONYMS.get(normalizedInput);
    if (canonicalSlug !== undefined) {
        // Normalize the slug as well (e.g. "air_conditioning" → same after strip)
        const normalizedSlug = normalizeAmenityTerm(canonicalSlug);
        const synonymId = await searchAndMatch(
            canonicalSlug,
            normalizedSlug,
            amenityService,
            actor
        );
        if (synonymId !== null) {
            return synonymId;
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves scraped amenity name strings to Hospeda catalog amenity UUIDs.
 *
 * For each name in `input.names`, applies a two-step matching strategy:
 * 1. Direct normalized match against the catalog `slug`.
 * 2. Synonym-map lookup → canonical slug → second search + normalized match against `slug`.
 *
 * Anything that does not confidently match in either step (no match, partial
 * hit, or lookup error) goes to `unresolved`.
 *
 * **Never throws.** Any per-name error is absorbed and the name goes to
 * `unresolved`; the rest of the batch is still processed.
 *
 * @param input - {@link ResolveAmenitiesInput} — names, service, actor.
 * @returns `{ amenityIds, unresolved }` — both arrays are de-duplicated.
 *   `amenityIds` preserves first-occurrence order from `names`.
 *   `unresolved` preserves first-occurrence order from `names`.
 *
 * @example
 * ```ts
 * const { amenityIds, unresolved } = await resolveAmenities({
 *   names: ['WiFi', 'Pileta', 'UnknownThing'],
 *   amenityService,
 *   actor,
 * });
 * // amenityIds → ['uuid-wifi', 'uuid-pool']
 * // unresolved → ['UnknownThing']
 * ```
 */
export async function resolveAmenities(
    input: ResolveAmenitiesInput
): Promise<ResolveAmenitiesOutput> {
    const { names, amenityService, actor } = input;

    if (names.length === 0) {
        return { amenityIds: [], unresolved: [] };
    }

    // De-duplicate input names (case-sensitive de-dup — preserves first occurrence).
    const seenNames = new Set<string>();
    const uniqueNames: string[] = [];
    for (const name of names) {
        if (!seenNames.has(name)) {
            seenNames.add(name);
            uniqueNames.push(name);
        }
    }

    const resolvedIds = new Set<string>();
    const amenityIds: string[] = [];
    const unresolved: string[] = [];

    // Process lookups sequentially — amenity lists are short (typically < 20
    // items) and sequential requests avoid hammering the DB with concurrent
    // queries from what is already a background import operation.
    for (const name of uniqueNames) {
        const id = await lookupAmenityByName({ name, amenityService, actor });
        if (id !== null && !resolvedIds.has(id)) {
            resolvedIds.add(id);
            amenityIds.push(id);
        } else if (id === null) {
            unresolved.push(name);
        }
        // If id was found but already de-duped (two different names resolved to
        // the same catalog entry), the name is silently dropped — it would just
        // be a redundant association on the accommodation.
    }

    return { amenityIds, unresolved };
}
