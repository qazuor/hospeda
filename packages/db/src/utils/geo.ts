import type { AnyColumn, SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Shared Haversine geo-distance helpers (HOS-111 T-010).
 *
 * Extracted from the previously private, duplicated `buildGeoRadiusClause` /
 * `buildDistanceOrderExpr` functions in `accommodation.model.ts` so that
 * destination↔destination (HOS-111 "nearby destinations") and
 * destination↔accommodation distance queries share exactly one formula. This
 * module is also the foundation dependency for HOS-113 (points of interest).
 *
 * ## Coordinate storage contract
 *
 * Both `accommodations.location` and `destinations.location` store
 * coordinates as a nested JSONB object: `location.coordinates.{lat, long}`
 * (see `packages/schemas/src/common/location.schema.ts` — `CoordinatesSchema`).
 * Two details matter for every caller:
 *
 * - **Both fields are STRINGS**, not numbers — Postgres requires an explicit
 *   `::numeric` cast before any arithmetic (handled by
 *   {@link buildJsonbCoordinateExprs}).
 * - **The longitude key is `long`, NOT `lng`** — a common typo trap.
 *
 * `location.coordinates` itself is OPTIONAL/NULLABLE on both entities (R-1):
 * a row with no coordinates yields `NULL` from the JSONB path extraction,
 * which then propagates through the arithmetic and naturally excludes the
 * row from a `<=` radius comparison. {@link buildCoordinatesNotNullClause}
 * makes that exclusion EXPLICIT in the generated SQL instead of relying on
 * implicit NULL propagation — always add it to any query that must not
 * silently under-return rows lacking coordinates (e.g. an N-nearest fallback
 * that must never accidentally rank a NULL-coordinate row as "nearest").
 *
 * @module packages/db/utils/geo
 */

/**
 * Earth radius in kilometers used by every Haversine calculation in this
 * codebase. NG-3 (spec HOS-111): raw-SQL Haversine, not a PostGIS migration.
 */
export const EARTH_RADIUS_KM = 6371;

/**
 * Builds the numeric-cast SQL fragments for a JSONB `location.coordinates`
 * column's `lat` and `long` fields.
 *
 * @param column - The JSONB `location` column (e.g. `accommodations.location`
 *   or `destinations.location`) whose `coordinates.{lat,long}` sub-path holds
 *   the stored string coordinates.
 * @returns `{ latExpr, longExpr }` — numeric SQL fragments ready to compose
 *   into a larger expression (e.g. {@link buildHaversineDistanceExpr}).
 *
 * @example
 * ```ts
 * const { latExpr, longExpr } = buildJsonbCoordinateExprs(accommodations.location);
 * ```
 */
export function buildJsonbCoordinateExprs(column: AnyColumn): {
    readonly latExpr: SQL;
    readonly longExpr: SQL;
} {
    return {
        latExpr: sql`(${column}->'coordinates'->>'lat')::numeric`,
        longExpr: sql`(${column}->'coordinates'->>'long')::numeric`
    };
}

/**
 * Builds an explicit `coordinates IS NOT NULL` guard for a JSONB `location`
 * column.
 *
 * Use this whenever a query's correctness must NOT rely on implicit NULL
 * propagation through the Haversine arithmetic — e.g. an "N nearest" fallback
 * query (HOS-111 T-011) that must never rank a coordinate-less row.
 *
 * @param column - The JSONB `location` column to guard.
 * @returns A boolean SQL condition, `true` only when `coordinates` is present.
 */
export function buildCoordinatesNotNullClause(column: AnyColumn): SQL {
    return sql`${column}->'coordinates' IS NOT NULL`;
}

/**
 * Builds the raw Haversine great-circle distance expression, in kilometers,
 * between a stored `(latCol, longCol)` point and a caller-supplied
 * `(lat, long)` center.
 *
 * `latCol` / `longCol` MUST already be numeric SQL fragments (e.g. from
 * {@link buildJsonbCoordinateExprs}) — this function does not perform any
 * casting itself, so it composes equally well over a JSONB-extracted
 * coordinate or a plain numeric column (the latter is what HOS-113's
 * points-of-interest table is expected to use).
 *
 * @param params - Receive-object.
 * @param params.latCol - Numeric SQL fragment for the stored point's latitude.
 * @param params.longCol - Numeric SQL fragment for the stored point's longitude.
 * @param params.lat - Center latitude in degrees.
 * @param params.long - Center longitude in degrees.
 * @returns A numeric SQL expression: the distance in kilometers. `NULL` when
 *   either coordinate is `NULL` (see the module JSDoc's NULL-propagation note).
 *
 * @example
 * ```ts
 * const { latExpr, longExpr } = buildJsonbCoordinateExprs(destinations.location);
 * const distanceExpr = buildHaversineDistanceExpr({
 *   latCol: latExpr,
 *   longCol: longExpr,
 *   lat: anchor.lat,
 *   long: anchor.long
 * });
 * ```
 */
export function buildHaversineDistanceExpr(params: {
    readonly latCol: SQL;
    readonly longCol: SQL;
    readonly lat: number;
    readonly long: number;
}): SQL {
    const { latCol, longCol, lat, long } = params;
    return sql`(
        2 * ${EARTH_RADIUS_KM} * asin(
            sqrt(
                power(sin(radians((${latCol} - ${lat}) / 2)), 2)
                + cos(radians(${lat}))
                  * cos(radians(${latCol}))
                  * power(sin(radians((${longCol} - ${long}) / 2)), 2)
            )
        )
    )`;
}

/**
 * Builds an ORDER BY-ready Haversine distance expression with a sort
 * direction and `NULLS LAST` applied, so coordinate-less rows always sort to
 * the end regardless of `asc`/`desc`.
 *
 * @param params - Receive-object.
 * @param params.latCol - Numeric SQL fragment for the stored point's latitude.
 * @param params.longCol - Numeric SQL fragment for the stored point's longitude.
 * @param params.lat - Center latitude in degrees.
 * @param params.long - Center longitude in degrees.
 * @param params.order - Sort direction.
 * @returns A `SQL` fragment ready to pass to `.orderBy()`.
 */
export function buildDistanceOrderByExpr(params: {
    readonly latCol: SQL;
    readonly longCol: SQL;
    readonly lat: number;
    readonly long: number;
    readonly order: 'asc' | 'desc';
}): SQL {
    const { order, ...distanceParams } = params;
    const direction = order === 'desc' ? sql`DESC` : sql`ASC`;
    return sql`${buildHaversineDistanceExpr(distanceParams)} ${direction} NULLS LAST`;
}

/**
 * Builds a WHERE-clause boolean condition that keeps only rows whose stored
 * `(latCol, longCol)` point is within `radiusKm` of the supplied
 * `(lat, long)` center.
 *
 * A row with `NULL` coordinates naturally fails this comparison (NULL
 * propagation), but callers that need the exclusion to be EXPLICIT in the
 * generated SQL — e.g. for readability or when composing with `OR` — should
 * additionally AND-in {@link buildCoordinatesNotNullClause}.
 *
 * @param params - Receive-object.
 * @param params.latCol - Numeric SQL fragment for the stored point's latitude.
 * @param params.longCol - Numeric SQL fragment for the stored point's longitude.
 * @param params.lat - Center latitude in degrees.
 * @param params.long - Center longitude in degrees.
 * @param params.radiusKm - Maximum distance in kilometers (inclusive).
 * @returns A boolean SQL condition for use in `.where()`.
 *
 * @example
 * ```ts
 * const { latExpr, longExpr } = buildJsonbCoordinateExprs(accommodations.location);
 * const clause = buildWithinRadiusClause({
 *   latCol: latExpr,
 *   longCol: longExpr,
 *   lat: params.latitude,
 *   long: params.longitude,
 *   radiusKm: params.radius
 * });
 * ```
 */
export function buildWithinRadiusClause(params: {
    readonly latCol: SQL;
    readonly longCol: SQL;
    readonly lat: number;
    readonly long: number;
    readonly radiusKm: number;
}): SQL<unknown> {
    const { radiusKm, ...distanceParams } = params;
    return sql<unknown>`${buildHaversineDistanceExpr(distanceParams)} <= ${radiusKm}`;
}
