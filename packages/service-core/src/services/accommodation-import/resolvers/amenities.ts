/**
 * Amenity Name Resolver (SPEC-222 T-012)
 *
 * Resolves scraped amenity name strings to Hospeda catalog amenity UUIDs by
 * querying the {@link AmenityService} for each name and applying a STRICT
 * case-insensitive exact-match rule against the Spanish locale of the catalog
 * entry.
 *
 * ## Matching rule (STRICT exact-CI)
 *
 * The underlying DB search uses `name->>'es' ILIKE %term%`, which is a
 * substring match — it will return hits whose Spanish name *contains* the
 * search term, not only entries whose name *equals* the term. To avoid
 * mis-resolution (e.g. searching "Pool" matching "Rooftop Pool"), the resolver
 * applies a second, client-side filter:
 *
 *   `item.name.es.trim().toLowerCase() === inputName.trim().toLowerCase()`
 *
 * Only an item that passes this strict equality check is considered a
 * confident match and yields its `id`. Any ILIKE hit whose name does not
 * exactly match the input name (case-insensitively, after trimming) is treated
 * as a non-match and the original name goes to `unresolved`.
 *
 * This bias (under-resolve rather than mis-resolve) is intentional: the host
 * reviews the `unresolved` list and manually picks the right amenity. A
 * wrong auto-resolution would silently associate the wrong amenity — that is
 * worse than leaving it unresolved (SPEC-222 AC-9.3).
 *
 * @module services/accommodation-import/resolvers/amenities
 */

import type { AmenitySearchForListOutput, AmenitySearchInput } from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import type { AmenityService } from '../../amenity/amenity.service.js';

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
 * Attempts to resolve a single amenity name to a catalog UUID.
 *
 * Returns the amenity `id` when a STRICT case-insensitive exact match is found
 * against the Spanish locale (`name.es`) of at least one search result, or
 * `null` when no such match exists.
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

    let result: AmenitySearchForListOutput;
    try {
        const searchInput: AmenitySearchInput = {
            name: trimmedName,
            page: 1,
            pageSize: 10
        };
        result = await amenityService.searchForList(actor, searchInput);
    } catch {
        // searchForList threw — treat this name as unresolved.
        return null;
    }

    const lowerInput = trimmedName.toLowerCase();

    // Apply STRICT exact-CI matching: the Spanish locale name must equal the
    // input after trimming and lower-casing both sides.
    const match = result.data.find((item) => item.name.es.trim().toLowerCase() === lowerInput);

    return match?.id ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves scraped amenity name strings to Hospeda catalog amenity UUIDs.
 *
 * For each name in `input.names`, queries the amenity catalog via
 * `amenityService.searchForList` and applies a STRICT case-insensitive exact
 * match against the Spanish locale (`name.es`) of the results. A match yields
 * the amenity UUID; everything else (no match, fuzzy-only hit, or lookup error)
 * pushes the original name to `unresolved`.
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
 * // amenityIds → ['uuid-wifi', 'uuid-pileta']
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
