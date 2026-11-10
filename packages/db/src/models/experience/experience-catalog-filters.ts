/**
 * @file experience-catalog-filters.ts
 * @description WHERE-clause builders that restrict experience listings to those
 * carrying a given set of catalog rows (amenities or features).
 *
 * HOS-2085 gives the public experiences listing the same amenity and feature
 * filters the venue listing has (see `venue-catalog-filters.ts`, which this file
 * mirrors on purpose; read its docblock for the full rationale).
 *
 * Three points carry over unchanged:
 *
 * - **Location.** These live under `models/`, not `utils/`, because they import
 *   dbschema modules, which call `pgTable(...)` at module-load time. The utils
 *   barrel must stay schema-free.
 * - **Semantics.** Intersection, not union: two items selected means "has BOTH".
 * - **Raw identifiers.** The junction columns are emitted as raw quoted
 *   identifiers because Drizzle would otherwise alias a column reference inside
 *   the subquery against the OUTER query's table.
 */

import { type SQL, sql } from 'drizzle-orm';
import { experiences } from '../../schemas/experience/experiences.dbschema.ts';
import { rExperienceAmenity } from '../../schemas/experience/r_experience_amenity.dbschema.ts';
import { rExperienceFeature } from '../../schemas/experience/r_experience_feature.dbschema.ts';

/**
 * Build a WHERE clause restricting experience listings to those linked to ALL
 * of the given feature IDs (set intersection).
 *
 * @param featureIds - Feature UUIDs the listing must ALL carry. Must be non-empty;
 *   an empty list would produce `HAVING COUNT(...) = 0`, which matches nothing.
 * @returns A SQL condition suitable for `additionalConditions`.
 */
export function buildExperienceFeatureIntersectionClause(
    featureIds: readonly string[]
): SQL<unknown> {
    const n = featureIds.length;
    const idList = sql.join(
        featureIds.map((id) => sql`${id}`),
        sql`, `
    );
    return sql<unknown>`${experiences.id} IN (
        SELECT "r_experience_feature"."experience_id"
        FROM ${rExperienceFeature}
        WHERE "r_experience_feature"."feature_id" IN (${idList})
        GROUP BY "r_experience_feature"."experience_id"
        HAVING COUNT(DISTINCT "r_experience_feature"."feature_id") = ${n}
    )`;
}

/**
 * Build a WHERE clause restricting experience listings to those linked to ALL
 * of the given amenity IDs (set intersection).
 *
 * @param amenityIds - Amenity UUIDs the listing must ALL carry. Must be non-empty.
 * @returns A SQL condition suitable for `additionalConditions`.
 */
export function buildExperienceAmenityIntersectionClause(
    amenityIds: readonly string[]
): SQL<unknown> {
    const n = amenityIds.length;
    const idList = sql.join(
        amenityIds.map((id) => sql`${id}`),
        sql`, `
    );
    return sql<unknown>`${experiences.id} IN (
        SELECT "r_experience_amenity"."experience_id"
        FROM ${rExperienceAmenity}
        WHERE "r_experience_amenity"."amenity_id" IN (${idList})
        GROUP BY "r_experience_amenity"."experience_id"
        HAVING COUNT(DISTINCT "r_experience_amenity"."amenity_id") = ${n}
    )`;
}

/**
 * Assemble the catalog-membership conditions for an experience search.
 *
 * Returns an empty array when neither filter is active, so the caller can pass
 * the result straight through. Empty arrays mean "no filter", not "match nothing".
 *
 * @param params.amenities - Amenity UUIDs the listing must all carry.
 * @param params.features - Feature UUIDs the listing must all carry.
 * @returns Zero, one, or two SQL conditions, ANDed by the caller.
 */
export function buildExperienceCatalogConditions({
    amenities,
    features
}: {
    readonly amenities?: readonly string[];
    readonly features?: readonly string[];
}): SQL[] {
    const conditions: SQL[] = [];
    if (amenities && amenities.length > 0) {
        conditions.push(buildExperienceAmenityIntersectionClause(amenities));
    }
    if (features && features.length > 0) {
        conditions.push(buildExperienceFeatureIntersectionClause(features));
    }
    return conditions;
}
