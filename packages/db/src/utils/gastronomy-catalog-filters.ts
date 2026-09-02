/**
 * @file gastronomy-catalog-filters.ts
 * @description WHERE-clause builders that restrict gastronomy listings to those
 * carrying a given set of catalog rows (amenities or features).
 *
 * HOS-1054 needs this so a diner can ask the gastronomy listing for the places
 * that declare an apto — «sin TACC», «vegano», «sin lactosa» — instead of
 * calling each restaurant to ask. The aptos are ordinary `features` catalog
 * rows scoped to the `gastronomy` vertical, so filtering by apto IS filtering by
 * feature; there is no allergen-specific column and deliberately so (a new apto
 * is a new catalog row, not a migration).
 *
 * ## Why these live here and not in `GastronomyModel.search`
 *
 * `GastronomyService._executeSearch` does not call `GastronomyModel.search` — it
 * calls the base `findAllWithRelations` (to load `destination`/`owner` for the
 * card transform) and `count`. Both take an `additionalConditions: SQL[]`
 * escape hatch, so the service composes the clause rather than the model
 * building it internally. Exporting the builders keeps the raw SQL inside
 * `@repo/db`, where every other hand-written clause lives, instead of leaking a
 * `drizzle-orm` template into `service-core`.
 *
 * ## Semantics: intersection, not union
 *
 * Two aptos selected means "has BOTH", matching the accommodations listing's
 * amenity/feature chips (`buildAmenityIntersectionClause` in
 * `accommodation.model.ts`). For an allergen filter that is the only safe
 * reading: someone who is both celiac and lactose intolerant asking for
 * `gluten_free_options` + `lactose_free_options` must not be shown a place that
 * only satisfies one of them.
 *
 * ## Raw-identifier workaround
 *
 * The junction columns are emitted as raw quoted identifiers rather than as
 * Drizzle column references. Inside a subquery Drizzle would alias a referenced
 * column against the OUTER query's table, producing
 * `WHERE "gastronomies"."feature_id" = ...` — nonsense that fails at runtime.
 * The table reference (`${rGastronomyFeature}`) and the outer correlation
 * (`${gastronomies.id}`) resolve correctly and stay template args. Same
 * workaround, same reason, as the accommodation clauses.
 */

import { type SQL, sql } from 'drizzle-orm';
import { gastronomies } from '../schemas/gastronomy/gastronomy.dbschema.ts';
import { rGastronomyAmenity } from '../schemas/gastronomy/r_gastronomy_amenity.dbschema.ts';
import { rGastronomyFeature } from '../schemas/gastronomy/r_gastronomy_feature.dbschema.ts';

/**
 * Build a WHERE clause restricting gastronomy listings to those linked to ALL
 * of the given feature IDs (set intersection).
 *
 * The gastronomy "aptos" (sin TACC, vegano, vegetariano, sin lactosa, sin
 * frutos secos) are feature rows, so this is the clause backing the apto
 * filter.
 *
 * @param featureIds - Feature UUIDs the listing must ALL carry. Must be non-empty;
 *   an empty list would produce `HAVING COUNT(...) = 0`, which matches nothing.
 * @returns A SQL condition suitable for `additionalConditions`.
 */
export function buildGastronomyFeatureIntersectionClause(
    featureIds: readonly string[]
): SQL<unknown> {
    const n = featureIds.length;
    const idList = sql.join(
        featureIds.map((id) => sql`${id}`),
        sql`, `
    );
    return sql<unknown>`${gastronomies.id} IN (
        SELECT "r_gastronomy_feature"."gastronomy_id"
        FROM ${rGastronomyFeature}
        WHERE "r_gastronomy_feature"."feature_id" IN (${idList})
        GROUP BY "r_gastronomy_feature"."gastronomy_id"
        HAVING COUNT(DISTINCT "r_gastronomy_feature"."feature_id") = ${n}
    )`;
}

/**
 * Build a WHERE clause restricting gastronomy listings to those linked to ALL
 * of the given amenity IDs (set intersection).
 *
 * Included alongside the feature clause because `GastronomySearchSchema` has
 * always declared an `amenities` filter that the service silently discarded —
 * a schema that promises a filter and drops it is worse than no filter, since
 * the caller gets a 200 with an unfiltered page.
 *
 * @param amenityIds - Amenity UUIDs the listing must ALL carry. Must be non-empty.
 * @returns A SQL condition suitable for `additionalConditions`.
 */
export function buildGastronomyAmenityIntersectionClause(
    amenityIds: readonly string[]
): SQL<unknown> {
    const n = amenityIds.length;
    const idList = sql.join(
        amenityIds.map((id) => sql`${id}`),
        sql`, `
    );
    return sql<unknown>`${gastronomies.id} IN (
        SELECT "r_gastronomy_amenity"."gastronomy_id"
        FROM ${rGastronomyAmenity}
        WHERE "r_gastronomy_amenity"."amenity_id" IN (${idList})
        GROUP BY "r_gastronomy_amenity"."gastronomy_id"
        HAVING COUNT(DISTINCT "r_gastronomy_amenity"."amenity_id") = ${n}
    )`;
}

/**
 * Assemble the catalog-membership conditions for a gastronomy search.
 *
 * Returns an empty array when neither filter is active, so the caller can pass
 * the result straight through to `additionalConditions` without a null check.
 * Empty arrays are treated as "no filter", not as "match nothing": an
 * `?features=` with no values is a stray query param, not a request for zero
 * results.
 *
 * @param params.amenities - Amenity UUIDs the listing must all carry.
 * @param params.features - Feature UUIDs the listing must all carry.
 * @returns Zero, one, or two SQL conditions, ANDed by the caller.
 */
export function buildGastronomyCatalogConditions({
    amenities,
    features
}: {
    readonly amenities?: readonly string[];
    readonly features?: readonly string[];
}): SQL[] {
    const conditions: SQL[] = [];
    if (amenities && amenities.length > 0) {
        conditions.push(buildGastronomyAmenityIntersectionClause(amenities));
    }
    if (features && features.length > 0) {
        conditions.push(buildGastronomyFeatureIntersectionClause(features));
    }
    return conditions;
}
