/**
 * Accommodation Import — Destination Hint Resolver (SPEC-222)
 *
 * Builds a {@link DestinationHint} from a scraped locality/country string by
 * querying the destination search service and returning CANDIDATE destinations
 * for the host to pick from.
 *
 * IMPORTANT: This resolver NEVER sets or returns a `destinationId` FK, even
 * when a single exact match is found (SPEC-222 AC-8.2). The output is purely
 * advisory — the host makes the final mapping decision in the review UI.
 *
 * @module services/accommodation-import/resolvers/destination
 */

import type { Actor } from '../../../types/index.js';
import type { DestinationService } from '../../destination/destination.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input for {@link buildDestinationHint}.
 */
export interface BuildDestinationHintInput {
    /** Raw locality string scraped from the listing page (e.g. "Concepción del Uruguay"). */
    readonly locality?: string;
    /**
     * ISO 3166-1 alpha-2 country code scraped from the listing page (e.g. "AR").
     * Optional — used to narrow the search when the search service supports it.
     */
    readonly country?: string;
    /** Instantiated DestinationService used to perform the candidate lookup. */
    readonly destinationService: DestinationService;
    /** Actor performing the import operation (passed through to the service layer). */
    readonly actor: Actor;
}

/**
 * A single candidate destination the host can choose to link the accommodation to.
 */
export interface DestinationCandidate {
    /** UUID of the candidate destination record. */
    readonly id: string;
    /** Human-readable display name of the destination. */
    readonly name: string;
}

/**
 * Advisory destination hint included in the import response.
 *
 * - `scrapedLocality` is the raw string that was searched against the destination
 *   catalogue. Present when a locality was provided.
 * - `candidates` is the list of destinations that matched the search. Always an
 *   array (possibly empty). NEVER contains a pre-selected `destinationId`.
 */
export interface DestinationHint {
    /** Raw locality string as scraped from the listing page. */
    readonly scrapedLocality?: string;
    /**
     * Destination records that match the scraped locality.
     * The host must pick one (or none) — this is purely advisory.
     */
    readonly candidates: readonly DestinationCandidate[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of destination candidates to return to the host. */
const MAX_CANDIDATES = 5;

// ---------------------------------------------------------------------------
// buildDestinationHint
// ---------------------------------------------------------------------------

/**
 * Builds a destination hint from a scraped locality string.
 *
 * Queries the destination search with `searchScope: 'name'` so descriptions
 * that merely mention a nearby city do not pollute the candidates list. Maps
 * the returned items to minimal `{ id, name }` pairs for the host review UI.
 *
 * **SPEC-222 AC-8.2 enforcement:** This function NEVER returns a bare
 * `destinationId`, never auto-selects a destination, and never sets the FK —
 * even when exactly one candidate is found. The host always decides.
 *
 * @param input - Locality/country strings, a DestinationService, and an Actor.
 * @returns A {@link DestinationHint} with `scrapedLocality` and `candidates`.
 *   On any error (including service errors or thrown exceptions) returns
 *   `{ scrapedLocality, candidates: [] }` — never throws.
 *
 * @example
 * ```ts
 * const hint = await buildDestinationHint({
 *   locality: 'Concepción del Uruguay',
 *   country: 'AR',
 *   destinationService,
 *   actor,
 * });
 * // hint.candidates → [{ id: '...', name: 'Concepción del Uruguay' }, ...]
 * // hint.scrapedLocality → 'Concepción del Uruguay'
 * // destinationId is NEVER set here — the host picks from candidates.
 * ```
 */
export async function buildDestinationHint(
    input: BuildDestinationHintInput
): Promise<DestinationHint> {
    const { locality, country, destinationService, actor } = input;

    // Guard: nothing to search when locality is absent or blank.
    if (!locality || locality.trim().length === 0) {
        return { candidates: [] };
    }

    const trimmedLocality = locality.trim();

    try {
        const result = await destinationService.search(actor, {
            q: trimmedLocality,
            searchScope: 'name',
            pageSize: MAX_CANDIDATES,
            page: 1,
            ...(country ? { country } : {})
        });

        // Service returned an error — degrade gracefully.
        if (result.error) {
            return { scrapedLocality: trimmedLocality, candidates: [] };
        }

        const candidates: DestinationCandidate[] = (result.data?.items ?? []).map((dest) => ({
            id: dest.id,
            name: dest.name
        }));

        return {
            scrapedLocality: trimmedLocality,
            candidates
        };
    } catch {
        // Any unexpected error — return empty candidates, never throw.
        return { scrapedLocality: trimmedLocality, candidates: [] };
    }
}
