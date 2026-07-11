import type { Actor, ServiceContext } from '../../types';
import type { PointOfInterestService } from '../point-of-interest/point-of-interest.service';

/**
 * Default proximity-search radius (kilometers) applied to a "near POI"
 * accommodation search when the caller does not supply an explicit `radius`.
 *
 * HOS-113 OQ-5 — RESOLVED (owner-confirmed, 2026-07-10): 5km. See
 * `.specs/HOS-113-points-of-interest/spec.md` §11.
 */
export const DEFAULT_POI_PROXIMITY_RADIUS_KM = 5;

/**
 * Input to {@link resolvePoiToCoordinates}.
 */
export interface ResolvePoiToCoordinatesParams {
    /** UUID of the point of interest to resolve. Mutually exclusive with `poiSlug`. */
    readonly poiId?: string;
    /** Slug of the point of interest to resolve. Mutually exclusive with `poiId`. */
    readonly poiSlug?: string;
    /**
     * Explicit search radius in kilometers. Defaults to
     * {@link DEFAULT_POI_PROXIMITY_RADIUS_KM} when omitted.
     */
    readonly radius?: number;
}

/** Successful resolution: the POI's coordinates plus the radius to search within. */
export interface ResolvedPoiCoordinates {
    readonly found: true;
    /** The point of interest's latitude in decimal degrees. */
    readonly lat: number;
    /** The point of interest's longitude in decimal degrees. */
    readonly long: number;
    /** The radius (kilometers) to search within, resolved from `params.radius` or the default. */
    readonly radiusKm: number;
}

/** Resolution failure: neither `poiId` nor `poiSlug` matched an existing point of interest. */
export interface UnresolvedPoiCoordinates {
    readonly found: false;
}

/** Discriminated result of {@link resolvePoiToCoordinates}. */
export type PoiCoordinatesResolution = ResolvedPoiCoordinates | UnresolvedPoiCoordinates;

/**
 * Resolves a `poiId`/`poiSlug` accommodation-search parameter to the
 * coordinates + radius that feed the EXISTING `latitude`/`longitude`/`radius`
 * geo-search path (`packages/db/src/utils/geo.ts`'s `buildWithinRadiusClause`
 * / `buildDistanceOrderByExpr`, already wired into
 * `AccommodationModel.search`/`searchWithRelations`). HOS-113 §6.2, NG-2 — no
 * new distance SQL is introduced anywhere in this helper.
 *
 * Looks up the point of interest via `PointOfInterestService.getById`/
 * `getBySlug` (both public-read, no permission gate required — see
 * `checkCanViewPointOfInterest`). Deliberately NEVER throws on a not-found
 * POI: it returns `{ found: false }` so callers decide how to react. The
 * accommodation service's `_beforeSearch` hook turns a not-found result into
 * a `NOT_FOUND` `ServiceError` (HTTP 404) so the public API never silently
 * returns an empty page for a typo'd slug, but a different caller (e.g. a
 * best-effort AI resolver) is free to treat `{ found: false }` as "skip this
 * constraint" instead.
 *
 * @param params - Receive-object: `poiId` XOR `poiSlug`, plus an optional radius override.
 * @param actor - The actor performing the search (forwarded to the POI read for permission checks).
 * @param pointOfInterestService - The `PointOfInterestService` instance to query.
 * @param ctx - Optional service context (transaction propagation).
 * @returns The resolved `{ lat, long, radiusKm }`, or `{ found: false }` when
 *   neither id was provided or the lookup found nothing.
 */
export async function resolvePoiToCoordinates(
    params: ResolvePoiToCoordinatesParams,
    actor: Actor,
    pointOfInterestService: PointOfInterestService,
    ctx?: ServiceContext
): Promise<PoiCoordinatesResolution> {
    const { poiId, poiSlug, radius } = params;
    const radiusKm = radius ?? DEFAULT_POI_PROXIMITY_RADIUS_KM;

    if (!poiId && !poiSlug) {
        return { found: false };
    }

    const result = poiId
        ? await pointOfInterestService.getById(actor, poiId, ctx)
        : await pointOfInterestService.getBySlug(actor, poiSlug as string, ctx);

    if (result.error || !result.data) {
        return { found: false };
    }

    return {
        found: true,
        lat: result.data.lat,
        long: result.data.long,
        radiusKm
    };
}
