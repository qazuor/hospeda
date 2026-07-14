import type { PointOfInterest } from '@repo/schemas';
import { and, eq, getTableColumns, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { destinations } from '../../schemas/destination/destination.dbschema.ts';
import { pointsOfInterest } from '../../schemas/destination/point-of-interest.dbschema.ts';
import { rDestinationPointOfInterest } from '../../schemas/destination/r_destination_point_of_interest.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import {
    buildDistanceOrderByExpr,
    buildHaversineDistanceExpr,
    buildWithinRadiusClause
} from '../../utils/geo.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for the `points_of_interest` table (HOS-113). Coordinate-bearing
 * landmarks associated with one or more destinations via
 * `r_destination_point_of_interest` (M2M, OQ-1). Unlike `AttractionModel`,
 * POIs carry no `name` column (OQ-2) — display names resolve via
 * `@repo/i18n` keyed by `slug`.
 */
export class PointOfInterestModel extends BaseModelImpl<PointOfInterest> {
    protected table = pointsOfInterest;
    public entityName = 'pointsOfInterest';

    protected getTableName(): string {
        return 'pointsOfInterest';
    }

    /**
     * Resolves POI slugs to the destinations that have them, via
     * `r_destination_point_of_interest` (HOS-113 §6.2/§6.3 — accommodation
     * proximity search and AI search resolution entry point). Mirrors
     * `AttractionModel.findDestinationIdsBySlugs` exactly.
     *
     * Two-step query:
     *
     *   1. `points_of_interest.slug IN (slugs)`, filtered to non-deleted +
     *      ACTIVE rows only.
     *   2. `r_destination_point_of_interest.pointOfInterestId IN (matched
     *      POI ids)`, inner-joined to `destinations` and filtered to
     *      public + active + non-deleted destinations only (never resolves
     *      to a hidden/draft/deleted destination).
     *
     * Returns an empty array (never throws) when `slugs` is empty, when no
     * POI matches, or when no destination carries a matched POI — the
     * caller treats this as "constraint could not be resolved, skip it"
     * rather than an error.
     *
     * @param slugs - POI slug identifiers (e.g. from the curated NL
     *   allowlist, or an explicit `poiSlug` proximity-search param). Empty
     *   array short-circuits without a DB round-trip.
     * @param tx - Optional transaction client.
     * @returns Promise resolving to a de-duplicated array of destination UUIDs.
     */
    async findDestinationIdsBySlugs(
        slugs: readonly string[],
        tx?: DrizzleClient
    ): Promise<string[]> {
        if (slugs.length === 0) {
            return [];
        }

        try {
            const db = this.getClient(tx);

            const poiRows = await db
                .select({ id: pointsOfInterest.id })
                .from(pointsOfInterest)
                .where(
                    and(
                        inArray(pointsOfInterest.slug, [...slugs]),
                        isNull(pointsOfInterest.deletedAt),
                        eq(pointsOfInterest.lifecycleState, 'ACTIVE')
                    )
                );

            const poiIds = poiRows.map((row: { id: string }) => row.id);
            if (poiIds.length === 0) {
                logQuery(this.entityName, 'findDestinationIdsBySlugs', { slugs }, []);
                return [];
            }

            const relationRows = await db
                .select({ destinationId: rDestinationPointOfInterest.destinationId })
                .from(rDestinationPointOfInterest)
                .innerJoin(
                    destinations,
                    eq(destinations.id, rDestinationPointOfInterest.destinationId)
                )
                .where(
                    and(
                        inArray(rDestinationPointOfInterest.pointOfInterestId, poiIds),
                        isNull(destinations.deletedAt),
                        eq(destinations.visibility, 'PUBLIC'),
                        eq(destinations.lifecycleState, 'ACTIVE')
                    )
                );

            const destinationIds = Array.from(
                new Set(relationRows.map((row: { destinationId: string }) => row.destinationId))
            );
            logQuery(this.entityName, 'findDestinationIdsBySlugs', { slugs }, destinationIds);
            return destinationIds;
        } catch (error) {
            logError(this.entityName, 'findDestinationIdsBySlugs', { slugs }, error as Error);
            throw new DbError(
                this.entityName,
                'findDestinationIdsBySlugs',
                { slugs },
                (error as Error).message
            );
        }
    }

    /**
     * Finds POIs within `radiusKm` kilometers of a `(lat, long)` center,
     * ordered nearest-first, each row annotated with its computed
     * `distanceKm` (HOS-145 T-002 — DB-layer geo query for "POIs near a
     * point", reused by the accommodation "What's nearby" section and
     * HOS-146/147). Kept generic — no accommodation- or destination-specific
     * coupling.
     *
     * Unlike `accommodations`/`destinations` (JSONB `location.coordinates`,
     * see `utils/geo.ts` module doc), `points_of_interest` stores coordinates
     * as plain nullable `doublePrecision` columns (`lat`/`long`) — no
     * `::numeric` cast or JSONB extraction is needed, so `buildJsonbCoordinateExprs`
     * is NOT used here; the columns are passed directly as numeric SQL
     * fragments to the shared Haversine helpers.
     *
     * WHERE (AND): within `radiusKm`, `lat`/`long` both non-null (R-1 —
     * ~78% of the POI v2 dataset has null coordinates and must never reach
     * the numeric path), `lifecycleState = 'ACTIVE'`, and not soft-deleted.
     *
     * @param params - Receive-object.
     * @param params.lat - Center latitude in degrees.
     * @param params.long - Center longitude in degrees.
     * @param params.radiusKm - Maximum distance in kilometers (inclusive).
     * @param params.limit - Maximum number of rows to return.
     * @param tx - Optional transaction client.
     * @returns Promise resolving to POIs within radius, nearest first, each
     *   with a numeric `distanceKm` (coerced from the driver's numeric
     *   string representation).
     */
    async findWithinRadius(
        params: { lat: number; long: number; radiusKm: number; limit: number },
        tx?: DrizzleClient
    ): Promise<Array<PointOfInterest & { distanceKm: number }>> {
        const { lat, long, radiusKm, limit } = params;

        try {
            const db = this.getClient(tx);

            const latCol = sql`${pointsOfInterest.lat}`;
            const longCol = sql`${pointsOfInterest.long}`;

            const rows = await db
                .select({
                    ...getTableColumns(pointsOfInterest),
                    distanceKm: buildHaversineDistanceExpr({ latCol, longCol, lat, long })
                })
                .from(pointsOfInterest)
                .where(
                    and(
                        buildWithinRadiusClause({ latCol, longCol, lat, long, radiusKm }),
                        isNotNull(pointsOfInterest.lat),
                        isNotNull(pointsOfInterest.long),
                        eq(pointsOfInterest.lifecycleState, 'ACTIVE'),
                        isNull(pointsOfInterest.deletedAt)
                    )
                )
                .orderBy(buildDistanceOrderByExpr({ latCol, longCol, lat, long, order: 'asc' }))
                .limit(limit);

            const result = rows.map((row) => ({
                ...row,
                distanceKm: Number(row.distanceKm)
            })) as Array<PointOfInterest & { distanceKm: number }>;

            logQuery(this.entityName, 'findWithinRadius', params, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findWithinRadius', params, error as Error);
            throw new DbError(
                this.entityName,
                'findWithinRadius',
                params,
                (error as Error).message
            );
        }
    }
}

/** Singleton instance of PointOfInterestModel for use across the application. */
export const pointOfInterestModel = new PointOfInterestModel();
