/**
 * Point-of-interest → destination + coordinate resolution for the AI
 * search-chat handler (HOS-113 §6.3 — "cerca del autódromo").
 *
 * Structurally mirrors `attraction-resolver.ts` (HOS-111 T-016) — a pure
 * combination function (unit-testable with zero mocking) plus a thin async
 * wrapper around `PointOfInterestService` — with one addition: because a
 * point of interest is a NAMED landmark (not a concept spanning several
 * rows), a successful resolution also exposes the matched landmark's own
 * `{ lat, long }` so the caller (T-042) can drive the existing "near POI"
 * proximity-search path (`poiId`/`poiSlug` on the accommodation search,
 * HOS-113 §6.2) — never new distance SQL.
 *
 * ## Owner decision — empty-intersection is a NO-MATCH, not a fallback
 *
 * Same INTERSECT-OR-NO-MATCH rule as `attraction-resolver.ts` (spec §6.3
 * point 3): when the user gives BOTH an explicit location AND a
 * point-of-interest mention, and the two share no destination, this resolver
 * reports `no-match` rather than silently substituting the POI's
 * destinations. The same NO-MATCH outcome applies when the matched POI(s)
 * resolve to zero destinations at all.
 *
 * One deliberate divergence from `attraction-resolver.ts`, reconciled here
 * after a HOS-113 review pass (H-1/M-1): a POI `no-match` does NOT force the
 * search to return ZERO accommodations the way an attraction conflict does.
 * `search-chat.ts` leaves `params` untouched on `no-match`/`none` — the
 * accommodation search still runs, just without the proximity narrowing
 * (see Step 7.7's comment there). Forcing zero results was never
 * implemented for POI and is out of scope for T-038..T-044. What WAS
 * missing — and is now fixed — is the REPLY narrative: `search-chat.ts`
 * builds a `poiLocationConflict` (mirroring `attractionLocationConflict`'s
 * shape) whenever this resolver returns `no-match`, or `none` with a raw
 * `poiSlugs` mention still present, and `buildSearchReplyMessages`
 * (`search-chat.prompt.ts`) both scrubs the unresolved slug out of the
 * reply's filters context and injects a corrective system note — so the
 * assistant never narrates a proximity search that didn't actually run.
 * That correction is narrative-only; it never blocks the search itself, so
 * there is still no `poiLocationConflict` field on the `filters` SSE frame
 * (unlike `AttractionLocationConflictSchema`).
 *
 * Non-fatal on infrastructure failure: a service error/throw degrades to
 * `none` (constraint skipped), NOT `no-match` — a DB failure is not evidence
 * that "this landmark has no destination", so it must not force a misleading
 * "no existe ese lugar" message. It still gets the same reply-narrative
 * correction as a `no-match` when a raw mention was present (see above),
 * since the model's context should never carry a slug that was not actually
 * applied, regardless of why.
 *
 * @module apps/api/routes/ai/protected/poi-resolver
 */

import type { Actor } from '@repo/service-core';
import { PointOfInterestService } from '@repo/service-core';
import { apiLogger } from '../../../utils/logger.js';

/**
 * Result of combining a POI-matched destination set with any existing
 * location constraint.
 *
 * - `constrain` — apply `destinationIds` to the accommodation search.
 * - `no-match` — the two constraints are incompatible; the search must return
 *   zero results and the assistant must explain the conflict.
 */
export type PoiDestinationConstraintOutcome =
    | { readonly kind: 'constrain'; readonly destinationIds: string[] }
    | { readonly kind: 'no-match' };

/**
 * Full resolution result for a turn's `poiSlugs`.
 *
 * - `none` — no change to the search (empty slugs, the primary POI's
 *   coordinates could not be resolved, or a non-fatal service failure that
 *   must degrade gracefully).
 * - `constrain` — constrain the search to `destinationIds` AND center a
 *   proximity search on the primary matched POI's `{ lat, long }`.
 * - `no-match` — the point of interest is incompatible with the requested
 *   location (or matched no destination at all): return zero results +
 *   explain.
 */
export type PoiResolution =
    | { readonly kind: 'none' }
    | {
          readonly kind: 'constrain';
          readonly destinationIds: string[];
          readonly poiSlugs: readonly string[];
          readonly lat: number;
          readonly long: number;
      }
    | { readonly kind: 'no-match'; readonly poiSlugs: readonly string[] };

/**
 * Decides the outcome given a NON-empty POI-matched destination set and
 * whatever location constraint the search already has (a resolved single
 * `destinationId`, a nearby-expanded `destinationIds` set, or none — the
 * caller flattens either shape into `currentDestinationIds` before calling
 * this).
 *
 * Rules (owner decision, mirrors `combineAttractionDestinationConstraint`):
 * - No existing constraint → constrain to the POI-matched set.
 * - Existing constraint, NON-empty intersection → constrain to the intersection.
 * - Existing constraint, EMPTY intersection → `no-match` (return zero + explain);
 *   NOT a silent substitution of the POI's destinations.
 *
 * Pure function — no I/O, safe to unit test directly. Callers must not pass an
 * empty `poiDestinationIds` (the "POI matched no destination" case is a
 * `no-match` decided upstream in {@link resolvePoiConstraint}).
 *
 * @param params - Receive-object.
 * @param params.poiDestinationIds - Destinations resolved from the matched
 *   POI slug(s) (must be non-empty).
 * @param params.currentDestinationIds - The search's existing destination
 *   constraint, if any (flattened single-id-as-array or multi-id array).
 * @returns A `constrain` or `no-match` outcome.
 */
export function combinePoiDestinationConstraint({
    poiDestinationIds,
    currentDestinationIds
}: {
    readonly poiDestinationIds: readonly string[];
    readonly currentDestinationIds?: readonly string[];
}): PoiDestinationConstraintOutcome {
    if (currentDestinationIds === undefined || currentDestinationIds.length === 0) {
        return { kind: 'constrain', destinationIds: [...poiDestinationIds] };
    }

    const poiSet = new Set(poiDestinationIds);
    const intersected = currentDestinationIds.filter((id) => poiSet.has(id));
    if (intersected.length > 0) {
        return { kind: 'constrain', destinationIds: intersected };
    }
    // Empty intersection: the requested location and point of interest are
    // incompatible. Owner decision: zero results + explanation, NOT a silent
    // substitution of the POI's destinations.
    return { kind: 'no-match' };
}

/**
 * Resolves `poiSlugs` (T-040) to a {@link PoiResolution} via
 * `PointOfInterestService`, combining with any existing location constraint
 * via {@link combinePoiDestinationConstraint}.
 *
 * The PRIMARY (first-matched) slug's coordinates are resolved via
 * `getBySlug` — a point of interest is a single named landmark, so unlike
 * attraction's concept-spanning-several-rows case, one representative
 * coordinate pair is enough to center a proximity search.
 * `getDestinationIdsByPointOfInterestSlugs` is then called with ALL matched
 * slugs to compute the destination-intersect outcome, same as attraction.
 *
 * Never throws. Outcomes:
 * - `none` when `poiSlugs` is empty, the primary POI's coordinates could not
 *   be resolved, the service errors, or the service throws (all logged via
 *   `apiLogger.warn` — non-fatal degrade).
 * - `no-match` when the matched POI(s) resolved to NO destination at all, OR
 *   the POI-matched set does not intersect the existing location constraint.
 * - `constrain` with the destinationIds to apply, the matched `poiSlugs`, and
 *   the primary POI's `{ lat, long }` for the caller's proximity search.
 *
 * @param params - Receive-object.
 * @param params.actor - The authenticated actor (forwarded to the service
 *   permission checks).
 * @param params.poiSlugs - Point-of-interest slugs extracted this turn
 *   (`validatedEntities.poiSlugs`, may be empty).
 * @param params.currentDestinationIds - The search's existing destination
 *   constraint, if any (see {@link combinePoiDestinationConstraint}).
 * @returns The resolution to apply.
 */
export async function resolvePoiConstraint({
    actor,
    poiSlugs,
    currentDestinationIds
}: {
    readonly actor: Actor;
    readonly poiSlugs: readonly string[];
    readonly currentDestinationIds?: readonly string[];
}): Promise<PoiResolution> {
    if (poiSlugs.length === 0) {
        return { kind: 'none' };
    }

    try {
        const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });
        // biome-ignore lint/style/noNonNullAssertion: poiSlugs.length > 0 is checked above
        const primarySlug = poiSlugs[0]!;

        const poiResult = await pointOfInterestService.getBySlug(actor, primarySlug);
        if (poiResult.error || !poiResult.data) {
            apiLogger.warn(
                { poiSlugs, primarySlug, error: poiResult.error?.message },
                'search-chat: poi coordinate resolution failed (non-fatal, constraint skipped)'
            );
            return { kind: 'none' };
        }
        const { lat, long } = poiResult.data;

        const destinationResult =
            await pointOfInterestService.getDestinationIdsByPointOfInterestSlugs(actor, {
                slugs: [...poiSlugs]
            });

        if (destinationResult.error) {
            apiLogger.warn(
                { poiSlugs, error: destinationResult.error.message },
                'search-chat: poi-destination resolution failed (non-fatal, constraint skipped)'
            );
            return { kind: 'none' };
        }

        if (destinationResult.data.destinationIds.length === 0) {
            // The user mentioned a landmark that no destination carries.
            // Owner decision: this is a no-match (zero results + explanation),
            // not a silently-dropped constraint.
            return { kind: 'no-match', poiSlugs: [...poiSlugs] };
        }

        const outcome = combinePoiDestinationConstraint({
            poiDestinationIds: destinationResult.data.destinationIds,
            currentDestinationIds
        });
        if (outcome.kind === 'constrain') {
            return {
                kind: 'constrain',
                destinationIds: outcome.destinationIds,
                poiSlugs: [...poiSlugs],
                lat,
                long
            };
        }
        return { kind: 'no-match', poiSlugs: [...poiSlugs] };
    } catch (error) {
        apiLogger.warn(
            {
                poiSlugs,
                error: error instanceof Error ? error.message : String(error)
            },
            'search-chat: poi resolution threw (non-fatal, constraint skipped)'
        );
        return { kind: 'none' };
    }
}
