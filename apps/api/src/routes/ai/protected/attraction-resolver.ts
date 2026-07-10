/**
 * Attraction → destination resolution for the AI search-chat handler
 * (HOS-111 T-016, G-11 — "una ciudad con carnavales").
 *
 * Split into a pure combination function (unit-testable with zero mocking)
 * and a thin async wrapper around `AttractionService`.
 *
 * ## Owner decision — empty-intersection is a NO-MATCH, not a fallback
 *
 * When the user gives BOTH an explicit location (a resolved `destinationId`,
 * or a Phase-2 nearby-expanded set) AND an attraction, and the two share no
 * destination, the chat must return ZERO accommodations and the assistant
 * must explain the conflict — it must NOT silently substitute the attraction's
 * destinations. The same NO-MATCH outcome applies when the attraction resolves
 * to zero destinations at all. A `no-match` outcome carries the attraction
 * slugs so the reply can name the conflict.
 *
 * Non-fatal on infrastructure failure: a service error/throw degrades to
 * `none` (constraint skipped), NOT `no-match` — a DB failure is not evidence
 * that "no destination has this attraction", so it must not force a misleading
 * "there's no carnaval anywhere" message.
 *
 * @module apps/api/routes/ai/protected/attraction-resolver
 */

import type { Actor } from '@repo/service-core';
import { AttractionService } from '@repo/service-core';
import { apiLogger } from '../../../utils/logger.js';

/**
 * Result of combining an attraction-matched destination set with any existing
 * location constraint.
 *
 * - `constrain` — apply `destinationIds` to the accommodation search.
 * - `no-match` — the two constraints are incompatible; the search must return
 *   zero results and the assistant must explain the conflict.
 */
export type AttractionConstraintOutcome =
    | { readonly kind: 'constrain'; readonly destinationIds: string[] }
    | { readonly kind: 'no-match' };

/**
 * Full resolution result for a turn's `attractionSlugs`.
 *
 * - `none` — no change to the search (empty slugs, or a non-fatal service
 *   failure that must degrade gracefully).
 * - `constrain` — constrain the search to `destinationIds`.
 * - `no-match` — the attraction is incompatible with the requested location
 *   (or matched nothing at all): return zero results + explain.
 */
export type AttractionResolution =
    | { readonly kind: 'none' }
    | { readonly kind: 'constrain'; readonly destinationIds: string[] }
    | { readonly kind: 'no-match'; readonly attractionSlugs: readonly string[] };

/**
 * Decides the outcome given a NON-empty attraction-matched destination set and
 * whatever location constraint the search already has (a resolved single
 * `destinationId`, a nearby-expanded `destinationIds` set, or none — the caller
 * flattens either shape into `currentDestinationIds` before calling this).
 *
 * Rules (owner decision):
 * - No existing constraint → constrain to the attraction-matched set.
 * - Existing constraint, NON-empty intersection → constrain to the intersection.
 * - Existing constraint, EMPTY intersection → `no-match` (return zero + explain);
 *   NOT a silent substitution of the attraction destinations.
 *
 * Pure function — no I/O, safe to unit test directly. Callers must not pass an
 * empty `attractionDestinationIds` (the "attraction matched nothing" case is a
 * `no-match` decided upstream in {@link resolveAttractionConstraint}).
 *
 * @param params - Receive-object.
 * @param params.attractionDestinationIds - Destinations resolved from the
 *   matched attraction slug(s) (must be non-empty).
 * @param params.currentDestinationIds - The search's existing destination
 *   constraint, if any (flattened single-id-as-array or multi-id array).
 * @returns A `constrain` or `no-match` outcome.
 */
export function combineAttractionDestinationConstraint({
    attractionDestinationIds,
    currentDestinationIds
}: {
    readonly attractionDestinationIds: readonly string[];
    readonly currentDestinationIds?: readonly string[];
}): AttractionConstraintOutcome {
    if (currentDestinationIds === undefined || currentDestinationIds.length === 0) {
        return { kind: 'constrain', destinationIds: [...attractionDestinationIds] };
    }

    const attractionSet = new Set(attractionDestinationIds);
    const intersected = currentDestinationIds.filter((id) => attractionSet.has(id));
    if (intersected.length > 0) {
        return { kind: 'constrain', destinationIds: intersected };
    }
    // Empty intersection: the requested location and attraction are
    // incompatible. Owner decision: zero results + explanation, NOT a silent
    // substitution of the attraction destinations.
    return { kind: 'no-match' };
}

/**
 * Resolves `attractionSlugs` (T-015) to an {@link AttractionResolution} via
 * `AttractionService.getDestinationIdsByAttractionSlugs`, combining with any
 * existing location constraint via {@link combineAttractionDestinationConstraint}.
 *
 * Never throws. Outcomes:
 * - `none` when `attractionSlugs` is empty, the service errors, or the service
 *   throws (both logged via `apiLogger.warn` — non-fatal degrade).
 * - `no-match` when the attraction matched NO destination at all, OR the
 *   attraction-matched set does not intersect the existing location constraint.
 * - `constrain` with the destinationIds to apply otherwise.
 *
 * @param params - Receive-object.
 * @param params.actor - The authenticated actor (forwarded to the service
 *   permission check).
 * @param params.attractionSlugs - Attraction slugs extracted this turn
 *   (`validatedEntities.attractionSlugs`, may be empty).
 * @param params.currentDestinationIds - The search's existing destination
 *   constraint, if any (see {@link combineAttractionDestinationConstraint}).
 * @returns The resolution to apply.
 */
export async function resolveAttractionConstraint({
    actor,
    attractionSlugs,
    currentDestinationIds
}: {
    readonly actor: Actor;
    readonly attractionSlugs: readonly string[];
    readonly currentDestinationIds?: readonly string[];
}): Promise<AttractionResolution> {
    if (attractionSlugs.length === 0) {
        return { kind: 'none' };
    }

    try {
        const attractionService = new AttractionService({ logger: apiLogger });
        const result = await attractionService.getDestinationIdsByAttractionSlugs(actor, {
            slugs: [...attractionSlugs]
        });

        if (result.error) {
            apiLogger.warn(
                { attractionSlugs, error: result.error.message },
                'search-chat: attraction-destination resolution failed (non-fatal, constraint skipped)'
            );
            return { kind: 'none' };
        }

        if (result.data.destinationIds.length === 0) {
            // The user asked for an attraction that NO destination carries.
            // Owner decision: this is a no-match (zero results + explanation),
            // not a silently-dropped constraint.
            return { kind: 'no-match', attractionSlugs: [...attractionSlugs] };
        }

        const outcome = combineAttractionDestinationConstraint({
            attractionDestinationIds: result.data.destinationIds,
            currentDestinationIds
        });
        if (outcome.kind === 'constrain') {
            return outcome;
        }
        return { kind: 'no-match', attractionSlugs: [...attractionSlugs] };
    } catch (error) {
        apiLogger.warn(
            {
                attractionSlugs,
                error: error instanceof Error ? error.message : String(error)
            },
            'search-chat: attraction-destination resolution threw (non-fatal, constraint skipped)'
        );
        return { kind: 'none' };
    }
}
