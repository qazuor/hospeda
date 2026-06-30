import type {
    Accommodation,
    AccommodationRatingInput,
    AccommodationSearchInput,
    DestinationSummary,
    SortField,
    UserSummary
} from '@repo/schemas';
import type { AnyColumn, SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, gte, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { rAccommodationAmenity } from '../../schemas/accommodation/r_accommodation_amenity.dbschema.ts';
import { rAccommodationFeature } from '../../schemas/accommodation/r_accommodation_feature.dbschema.ts';
import { destinations } from '../../schemas/destination/destination.dbschema.ts';
import { userBookmarks } from '../../schemas/user/user_bookmark.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

/**
 * Nullable numeric columns where Postgres' default NULLS handling causes UX surprises.
 * With `DESC`, Postgres places NULLs FIRST by default — so "sort by rating desc" would
 * bubble up rows WITHOUT rating. We force `NULLS LAST` for these fields regardless of
 * direction so empty values are always last.
 */
const NUMERIC_NULLABLE_FIELDS = new Set<string>(['averageRating', 'reviewsCount']);

/**
 * Build a Drizzle-compatible sort expression. For nullable numeric fields we emit a raw
 * `NULLS LAST` fragment (Drizzle's `asc`/`desc` do not expose NULLS positioning). For
 * every other column we defer to the stock helpers.
 */
function buildSortExpr(column: AnyColumn, order: 'asc' | 'desc', field: string): SQL {
    if (NUMERIC_NULLABLE_FIELDS.has(field)) {
        return order === 'desc' ? sql`${column} DESC NULLS LAST` : sql`${column} ASC NULLS LAST`;
    }
    return order === 'desc' ? desc(column) : asc(column);
}

/**
 * Synthetic sort field name that orders accommodations by the number of active
 * (non-deleted) bookmarks pointing at them. Implemented as a correlated subquery
 * against `user_bookmarks` filtered by `entity_type = 'ACCOMMODATION'` and
 * `deleted_at IS NULL`. SPEC-098 T-052.
 *
 * Performance depends on the compound index `idx_user_bookmarks_entity_active`
 * on `(entity_id, entity_type, deleted_at)` (see SPEC-098 T-008 and the
 * `0019_user_bookmarks_entity_active_index.sql` manual migration).
 */
const MOST_SAVED_SORT_FIELD = 'mostSaved';

/**
 * Synthetic sort field name that orders accommodations by their JSONB-extracted
 * base price. Backed by `(price->>'price')::numeric` — the seed/model contract
 * stores the nightly base price under `price.price` in ARS, with sibling fields
 * `currency` and `discounts`. Accommodations with `price = NULL` or no `price`
 * key bubble to the end thanks to `NULLS LAST`.
 */
const PRICE_SORT_FIELD = 'price';

/**
 * Build the correlated subquery used as the ORDER BY expression for the
 * `mostSaved` synthetic sort. NULL counts (i.e. no active bookmarks) are folded
 * to zero by `COUNT(*)`, so no `NULLS LAST` clause is required.
 *
 * Implementation note (`sql.raw` identifiers): when this expression is composed
 * into `searchWithRelations` (Drizzle's relational API with lateral joins),
 * template-literal column refs like `${userBookmarks.entityId}` get re-aliased
 * to the OUTER table (`accommodations`), producing
 * `WHERE "accommodations"."entity_id" = ...` — nonsense that fails at runtime
 * with a 500. Emitting the `user_bookmarks` column names as raw identifiers
 * avoids the aliasing. The table reference (`${userBookmarks}`) and the outer
 * correlation (`${accommodations.id}`) resolve correctly and stay template args.
 * Same workaround as {@link buildAmenityIntersectionClause}.
 */
function buildMostSavedOrderExpr(order: 'asc' | 'desc'): SQL {
    const direction = order === 'desc' ? sql`DESC` : sql`ASC`;
    return sql`(
        SELECT COUNT(*) FROM ${userBookmarks}
        WHERE "user_bookmarks"."entity_id" = ${accommodations.id}
          AND "user_bookmarks"."entity_type" = 'ACCOMMODATION'
          AND "user_bookmarks"."deleted_at" IS NULL
    ) ${direction}`;
}

/**
 * Build the ORDER BY expression for the `price` synthetic sort. Extracts the
 * base price from the JSONB `price` column (`price.price`) as numeric. NULLs go
 * last regardless of direction so unpriced rows do not dominate the first page
 * of a `priceAsc` sort.
 */
function buildPriceOrderExpr(order: 'asc' | 'desc'): SQL {
    const direction = order === 'desc' ? sql`DESC` : sql`ASC`;
    return sql`(${accommodations.price}->>'price')::numeric ${direction} NULLS LAST`;
}

/**
 * Synthetic sort field that orders accommodations by haversine distance from a
 * caller-supplied `(centerLat, centerLong)` center. Only honored when the
 * caller passes the coordinates in (otherwise the field is silently dropped
 * upstream so the URL stays usable when no geo center is active). Mirrors the
 * SQL formula used by `buildGeoRadiusClause` (Earth radius 6371 km) so the
 * sort distance and the filter distance match exactly.
 *
 * Rows missing JSONB coordinates bubble to the end via `NULLS LAST`, which
 * also keeps the result deterministic when the cast yields NULL.
 */
const DISTANCE_SORT_FIELD = 'distance';

function buildDistanceOrderExpr(centerLat: number, centerLong: number, order: 'asc' | 'desc'): SQL {
    const direction = order === 'desc' ? sql`DESC` : sql`ASC`;
    return sql`(
        2 * 6371 * asin(
            sqrt(
                power(sin(radians(((${accommodations.location}->'coordinates'->>'lat')::numeric - ${centerLat}) / 2)), 2)
                + cos(radians(${centerLat}))
                  * cos(radians((${accommodations.location}->'coordinates'->>'lat')::numeric))
                  * power(sin(radians(((${accommodations.location}->'coordinates'->>'long')::numeric - ${centerLong}) / 2)), 2)
            )
        )
    ) ${direction} NULLS LAST`;
}

/**
 * Build WHERE-clause conditions for `minPrice` / `maxPrice` filters. Operates
 * on the JSONB-extracted base price (`(price->>'price')::numeric`) instead of
 * comparing the whole JSONB object to a number (which Postgres allows but
 * yields lexicographic comparisons, not numeric — i.e. silently wrong).
 *
 * Returns an empty array when neither bound is set so callers can spread the
 * result into a `whereClauses` array unconditionally.
 */
function buildBasePriceConditions(
    min: number | undefined,
    max: number | undefined
): SQL<unknown>[] {
    const out: SQL<unknown>[] = [];
    if (min !== undefined) {
        out.push(sql`(${accommodations.price}->>'price')::numeric >= ${min}`);
    }
    if (max !== undefined) {
        out.push(sql`(${accommodations.price}->>'price')::numeric <= ${max}`);
    }
    return out;
}

/**
 * Compose the full ORDER BY list for accommodation search queries.
 *
 * Precedence (applied in order):
 *   1. `featuredFirst` pin     → `(isFeatured OR featuredByPlan) DESC` prepended
 *                                (SPEC-292: admin-curated OR plan-derived featuring).
 *   2. `sorts[]` if present    → iterated in declared order. Any `isFeatured`
 *                                entry is dropped when `featuredFirst` is pinned
 *                                (prevents a duplicated `ORDER BY is_featured`).
 *   3. Legacy `sortBy`/`sortOrder` fallback when `sorts[]` is absent or empty.
 *                                Also dropped if it would duplicate the pin.
 *   4. `id DESC`               → stable tiebreaker, ALWAYS appended so pagination
 *                                is deterministic when leading sort keys tie.
 *
 * Unknown fields (not present on the `accommodations` table) are silently skipped,
 * preserving parity with the legacy single-column behavior.
 */
export function buildAccommodationOrderBy(params: {
    featuredFirst?: boolean;
    sorts?: SortField[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    /**
     * Center latitude for the `distance` synthetic sort. Required for the
     * `distance` sort to be honored; if absent (or `longitude` is absent), any
     * `distance` entry in `sorts`/`sortBy` is silently dropped so the URL
     * remains usable when no geo center is active.
     */
    latitude?: number;
    /** Center longitude for the `distance` synthetic sort. See `latitude`. */
    longitude?: number;
}): SQL[] {
    const orderBy: SQL[] = [];

    if (params.featuredFirst) {
        // SPEC-292 — effective featured = admin-curated (`isFeatured`) OR
        // plan-derived (`featuredByPlan`, set by the billing sync). Order by the
        // disjunction so both surface first; PG's BitmapOr combines the parallel
        // btree indexes on the two columns.
        orderBy.push(desc(sql`(${accommodations.isFeatured} OR ${accommodations.featuredByPlan})`));
    }

    const legacyFallback: SortField[] =
        params.sortBy && !(params.featuredFirst && params.sortBy === 'isFeatured')
            ? [{ field: params.sortBy, order: params.sortOrder ?? 'asc' }]
            : [];
    const rawSortFields: SortField[] =
        params.sorts && params.sorts.length > 0 ? params.sorts : legacyFallback;

    const sortFields = params.featuredFirst
        ? rawSortFields.filter((s) => s.field !== 'isFeatured')
        : rawSortFields;

    const hasGeoCenter = params.latitude !== undefined && params.longitude !== undefined;

    for (const sort of sortFields) {
        // SPEC-098 T-052 — synthetic field backed by a correlated subquery
        // against `user_bookmarks`. Handled before the column lookup because
        // `mostSaved` is not a real accommodation column.
        if (sort.field === MOST_SAVED_SORT_FIELD) {
            orderBy.push(buildMostSavedOrderExpr(sort.order));
            continue;
        }
        // Synthetic field that orders by JSONB-extracted base price. `price`
        // IS a column on the table but it is JSONB — Drizzle's `asc()/desc()`
        // would compare the whole object lexicographically. We extract the
        // base value explicitly to get numeric ordering.
        if (sort.field === PRICE_SORT_FIELD) {
            orderBy.push(buildPriceOrderExpr(sort.order));
            continue;
        }
        // Synthetic field that orders by haversine distance from a geo
        // center. Silently dropped if the caller did not supply
        // `latitude`/`longitude` — keeps the URL roundtrip stable when the
        // user toggles geo-radius off without changing the sort param.
        if (sort.field === DISTANCE_SORT_FIELD) {
            if (hasGeoCenter) {
                orderBy.push(
                    buildDistanceOrderExpr(
                        params.latitude as number,
                        params.longitude as number,
                        sort.order
                    )
                );
            }
            continue;
        }
        const column = accommodations[sort.field as keyof typeof accommodations];
        if (column && typeof column === 'object' && 'name' in column) {
            orderBy.push(buildSortExpr(column as AnyColumn, sort.order, sort.field));
        }
    }

    orderBy.push(desc(accommodations.id));
    return orderBy;
}

/**
 * Build a WHERE clause that restricts accommodations to those that have ALL
 * of the provided amenity IDs (set intersection).
 *
 * Uses a correlated subquery:
 *   accommodation.id IN (
 *     SELECT accommodation_id FROM r_accommodation_amenity
 *     WHERE amenity_id IN (...ids)
 *     GROUP BY accommodation_id
 *     HAVING COUNT(DISTINCT amenity_id) = N
 *   )
 *
 * When a single ID is provided the HAVING clause is `= 1`, which is
 * equivalent to a plain EXISTS but keeps the implementation uniform.
 */
/**
 * Build a WHERE clause that restricts accommodations to those that have ALL
 * of the provided amenity IDs (set intersection — AND semantics).
 *
 * Implementation note (`sql.raw` for column refs): when this clause is
 * composed into `searchWithRelations` (Drizzle's relational query API with
 * lateral joins), template-literal column refs like
 * `${rAccommodationAmenity.accommodationId}` get re-aliased to the OUTER
 * table (`accommodations`) and the subquery fails at runtime — the resulting
 * SQL reads `WHERE "accommodations"."amenity_id" = ...`, which is nonsense.
 *
 * Workaround: emit the column names as raw identifiers so Drizzle doesn't
 * try to alias them. The table reference (`${rAccommodationAmenity}`) is
 * kept as a template arg because Drizzle correctly resolves it to the
 * table name string in the FROM clause.
 */
function buildAmenityIntersectionClause(amenityIds: readonly string[]): SQL<unknown> {
    const n = amenityIds.length;
    const idList = sql.join(
        amenityIds.map((id) => sql`${id}`),
        sql`, `
    );
    return sql<unknown>`${accommodations.id} IN (
        SELECT "r_accommodation_amenity"."accommodation_id"
        FROM ${rAccommodationAmenity}
        WHERE "r_accommodation_amenity"."amenity_id" IN (${idList})
        GROUP BY "r_accommodation_amenity"."accommodation_id"
        HAVING COUNT(DISTINCT "r_accommodation_amenity"."amenity_id") = ${n}
    )`;
}

/**
 * Build a WHERE clause that restricts accommodations to those that have AT
 * LEAST ONE of the provided amenity IDs (OR semantics within the set).
 *
 * Used to back the public boolean shortcuts (`hasWifi`, `hasPool`,
 * `hasParking`, `allowsPets`) where the toggle should match against multiple
 * slug variants (e.g. `pool` + `heated_pool`). Different from
 * {@link buildAmenityIntersectionClause} which requires ALL ids.
 *
 * Same raw-identifier workaround as the intersection clause — see that
 * function's docstring for the Drizzle-aliasing background.
 */
function buildAnyAmenityClause(amenityIds: readonly string[]): SQL<unknown> {
    const idList = sql.join(
        amenityIds.map((id) => sql`${id}`),
        sql`, `
    );
    return sql<unknown>`${accommodations.id} IN (
        SELECT "r_accommodation_amenity"."accommodation_id"
        FROM ${rAccommodationAmenity}
        WHERE "r_accommodation_amenity"."amenity_id" IN (${idList})
    )`;
}

/**
 * Build a WHERE clause that restricts accommodations to those that have ALL
 * of the provided feature IDs (set intersection).
 *
 * Uses the same GROUP BY / HAVING COUNT(DISTINCT ...) = N pattern as
 * {@link buildAmenityIntersectionClause}.
 */
function buildFeatureIntersectionClause(featureIds: readonly string[]): SQL<unknown> {
    const n = featureIds.length;
    const idList = sql.join(
        featureIds.map((id) => sql`${id}`),
        sql`, `
    );
    return sql<unknown>`${accommodations.id} IN (
        SELECT "r_accommodation_feature"."accommodation_id"
        FROM ${rAccommodationFeature}
        WHERE "r_accommodation_feature"."feature_id" IN (${idList})
        GROUP BY "r_accommodation_feature"."accommodation_id"
        HAVING COUNT(DISTINCT "r_accommodation_feature"."feature_id") = ${n}
    )`;
}

/**
 * Builds a WHERE clause that keeps accommodations whose stored coordinates are
 * within `radiusKm` of the supplied center using the haversine formula. The
 * coordinates live under `location.coordinates.{lat,long}` (JSONB, stored as
 * strings) and are cast to numeric on the fly. Earth radius is 6371 km.
 */
function buildGeoRadiusClause(
    centerLat: number,
    centerLong: number,
    radiusKm: number
): SQL<unknown> {
    return sql<unknown>`(
        2 * 6371 * asin(
            sqrt(
                power(sin(radians(((${accommodations.location}->'coordinates'->>'lat')::numeric - ${centerLat}) / 2)), 2)
                + cos(radians(${centerLat}))
                  * cos(radians((${accommodations.location}->'coordinates'->>'lat')::numeric))
                  * power(sin(radians(((${accommodations.location}->'coordinates'->>'long')::numeric - ${centerLong}) / 2)), 2)
            )
        )
    ) <= ${radiusKm}`;
}

export class AccommodationModel extends BaseModelImpl<Accommodation> {
    protected table = accommodations;
    public entityName = 'accommodations';

    protected override readonly validRelationKeys = [
        'owner',
        'createdBy',
        'updatedBy',
        'deletedBy',
        'destination',
        'amenities',
        'features',
        'reviews',
        'faqs',
        'iaData',
        'tags'
    ] as const;

    /**
     * Grouped JSONB columns that must be **shallow-merged** (PostgreSQL `||`)
     * on update instead of wholesale-replaced, so a partial PATCH preserves the
     * sibling keys the caller did not send.
     *
     * - `media` — a partial media patch (e.g. only `gallery`) must not drop
     *   sibling keys like `featuredImage` (GAP-078-186, GAP-078-198).
     * - `price` / `extraInfo` / `contactInfo` / `socialNetworks` / `location`
     *   (SPEC-229) — single-field edits of these grouped columns (e.g. only
     *   `currency`, or only `bedrooms`) were silently lost because the column
     *   was replaced with the partial object. Merging preserves the unsent
     *   fields. The merge is shallow, which is correct: each group is one level
     *   deep (`location.coordinates` travels as a unit).
     */
    protected override readonly mergeableJsonbColumns = [
        'media',
        'price',
        'extraInfo',
        'contactInfo',
        'socialNetworks',
        'location'
    ] as const;

    protected getTableName(): string {
        return 'accommodations';
    }

    public async countByFilters(
        params: AccommodationSearchInput & {
            excludeRestricted?: boolean;
            excludeOwnerSuspended?: boolean;
            /** SPEC-167 T-004: exclude plan-restricted accommodations from public counts. */
            excludePlanRestricted?: boolean;
            /** Restrict results to ACTIVE lifecycle state (excludes DRAFT, INACTIVE, ARCHIVED). */
            activeOnly?: boolean;
        },
        tx?: DrizzleClient
    ): Promise<{ count: number }> {
        const db = this.getClient(tx);

        const whereClauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];
        if (params.ownerId) {
            whereClauses.push(eq(accommodations.ownerId, params.ownerId));
        }
        if (params.types && params.types.length > 0) {
            whereClauses.push(
                inArray(accommodations.type, params.types as (typeof accommodations.type._.data)[])
            );
        } else if (params.type) {
            whereClauses.push(eq(accommodations.type, params.type));
        }
        whereClauses.push(...buildBasePriceConditions(params.minPrice, params.maxPrice));
        if (params.destinationIds && params.destinationIds.length > 0) {
            whereClauses.push(inArray(accommodations.destinationId, params.destinationIds));
        } else if (params.destinationId) {
            whereClauses.push(eq(accommodations.destinationId, params.destinationId));
        }
        if (params.excludeRestricted) {
            whereClauses.push(ne(accommodations.visibility, 'RESTRICTED'));
        }
        if (params.excludeOwnerSuspended) {
            whereClauses.push(eq(accommodations.ownerSuspended, false));
        }
        // SPEC-167 T-004: plan-restricted accommodations are hidden from public reads.
        // Mirrors excludeOwnerSuspended treatment (same layers, same query helper).
        if (params.excludePlanRestricted) {
            whereClauses.push(eq(accommodations.planRestricted, false));
        }
        // Restrict to ACTIVE lifecycle state for public reads.
        // When true, excludes DRAFT, INACTIVE, and ARCHIVED accommodations.
        if (params.activeOnly) {
            whereClauses.push(eq(accommodations.lifecycleState, 'ACTIVE'));
        }
        if (params.minGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int >= ${params.minGuests}`
            );
        }
        if (params.maxGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int <= ${params.maxGuests}`
            );
        }
        if (params.minBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int >= ${params.minBedrooms}`
            );
        }
        if (params.maxBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int <= ${params.maxBedrooms}`
            );
        }
        if (params.minBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int >= ${params.minBathrooms}`
            );
        }
        if (params.maxBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int <= ${params.maxBathrooms}`
            );
        }
        if (params.minRating !== undefined) {
            whereClauses.push(gte(accommodations.averageRating, params.minRating));
        }
        if (params.amenities && params.amenities.length > 0) {
            // Intersection semantics: accommodation must have ALL provided amenity IDs.
            whereClauses.push(buildAmenityIntersectionClause(params.amenities));
        }
        if (params.anyAmenityGroups && params.anyAmenityGroups.length > 0) {
            // OR within each inner array (any variant counts), AND across
            // groups (each toggle is enforced independently). An empty inner
            // array means "the toggle was active but none of its canonical
            // slugs exist in the catalog" — match nothing, not everything.
            for (const group of params.anyAmenityGroups) {
                if (group.length === 0) {
                    whereClauses.push(sql<unknown>`FALSE`);
                } else {
                    whereClauses.push(buildAnyAmenityClause(group));
                }
            }
        }
        if (params.features && params.features.length > 0) {
            // Intersection semantics: accommodation must have ALL provided feature IDs.
            whereClauses.push(buildFeatureIntersectionClause(params.features));
        }
        if (params.q) {
            whereClauses.push(
                or(
                    safeIlike(accommodations.name, params.q),
                    safeIlike(accommodations.description, params.q)
                ) as SQL<unknown>
            );
        }

        // SPEC-097 — Viewport bbox filter on EXACT coordinates stored under
        // location.coordinates (JSONB). Mirrors the predicate in
        // searchWithRelations so paginated counts and totals agree.
        if (
            params.bboxNorth !== undefined &&
            params.bboxSouth !== undefined &&
            params.bboxEast !== undefined &&
            params.bboxWest !== undefined
        ) {
            whereClauses.push(
                sql`(${accommodations.location}->'coordinates'->>'lat')::numeric BETWEEN ${params.bboxSouth} AND ${params.bboxNorth}`
            );
            whereClauses.push(
                sql`(${accommodations.location}->'coordinates'->>'long')::numeric BETWEEN ${params.bboxWest} AND ${params.bboxEast}`
            );
        }

        // Geo radius filter — haversine distance in kilometers between the
        // accommodation's stored coordinates and the supplied center, capped at
        // `radius`. Requires the full triplet; partial input is ignored.
        if (
            params.latitude !== undefined &&
            params.longitude !== undefined &&
            params.radius !== undefined
        ) {
            whereClauses.push(
                buildGeoRadiusClause(params.latitude, params.longitude, params.radius)
            );
        }

        const where = and(...whereClauses);

        const totalQuery = db.select({ count: count() }).from(this.table).where(where);
        const totalResult = await totalQuery;
        return { count: Number(totalResult[0]?.count ?? 0) };
    }

    public async search(
        params: AccommodationSearchInput & {
            excludeRestricted?: boolean;
            excludeOwnerSuspended?: boolean;
            /** SPEC-167 T-004: exclude plan-restricted accommodations from public searches. */
            excludePlanRestricted?: boolean;
            /** Restrict results to ACTIVE lifecycle state (excludes DRAFT, INACTIVE, ARCHIVED). */
            activeOnly?: boolean;
        },
        tx?: DrizzleClient
    ): Promise<{ items: Accommodation[]; total: number }> {
        const db = this.getClient(tx);

        const whereClauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];
        if (params.ownerId) {
            whereClauses.push(eq(accommodations.ownerId, params.ownerId));
        }
        if (params.types && params.types.length > 0) {
            whereClauses.push(
                inArray(accommodations.type, params.types as (typeof accommodations.type._.data)[])
            );
        } else if (params.type) {
            whereClauses.push(eq(accommodations.type, params.type));
        }
        whereClauses.push(...buildBasePriceConditions(params.minPrice, params.maxPrice));
        if (params.destinationIds && params.destinationIds.length > 0) {
            whereClauses.push(inArray(accommodations.destinationId, params.destinationIds));
        } else if (params.destinationId) {
            whereClauses.push(eq(accommodations.destinationId, params.destinationId));
        }
        if (params.excludeRestricted) {
            whereClauses.push(ne(accommodations.visibility, 'RESTRICTED'));
        }
        if (params.excludeOwnerSuspended) {
            whereClauses.push(eq(accommodations.ownerSuspended, false));
        }
        // SPEC-167 T-004: plan-restricted accommodations are hidden from public reads.
        if (params.excludePlanRestricted) {
            whereClauses.push(eq(accommodations.planRestricted, false));
        }
        // Restrict to ACTIVE lifecycle state for public reads.
        // When true, excludes DRAFT, INACTIVE, and ARCHIVED accommodations.
        if (params.activeOnly) {
            whereClauses.push(eq(accommodations.lifecycleState, 'ACTIVE'));
        }
        if (params.minGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int >= ${params.minGuests}`
            );
        }
        if (params.maxGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int <= ${params.maxGuests}`
            );
        }
        if (params.minBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int >= ${params.minBedrooms}`
            );
        }
        if (params.maxBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int <= ${params.maxBedrooms}`
            );
        }
        if (params.minBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int >= ${params.minBathrooms}`
            );
        }
        if (params.maxBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int <= ${params.maxBathrooms}`
            );
        }
        if (params.minRating !== undefined) {
            whereClauses.push(gte(accommodations.averageRating, params.minRating));
        }
        if (params.amenities && params.amenities.length > 0) {
            // Intersection semantics: accommodation must have ALL provided amenity IDs.
            whereClauses.push(buildAmenityIntersectionClause(params.amenities));
        }
        if (params.anyAmenityGroups && params.anyAmenityGroups.length > 0) {
            // OR within each inner array (any variant counts), AND across
            // groups (each toggle is enforced independently). An empty inner
            // array means "the toggle was active but none of its canonical
            // slugs exist in the catalog" — match nothing, not everything.
            for (const group of params.anyAmenityGroups) {
                if (group.length === 0) {
                    whereClauses.push(sql<unknown>`FALSE`);
                } else {
                    whereClauses.push(buildAnyAmenityClause(group));
                }
            }
        }
        if (params.features && params.features.length > 0) {
            // Intersection semantics: accommodation must have ALL provided feature IDs.
            whereClauses.push(buildFeatureIntersectionClause(params.features));
        }
        if (params.q) {
            whereClauses.push(
                or(
                    safeIlike(accommodations.name, params.q),
                    safeIlike(accommodations.description, params.q)
                ) as SQL<unknown>
            );
        }

        // SPEC-097 — Viewport bbox filter on EXACT coordinates stored under
        // location.coordinates (JSONB). Mirrors the predicate in
        // searchWithRelations so the flat-list search also honors the map
        // viewport.
        if (
            params.bboxNorth !== undefined &&
            params.bboxSouth !== undefined &&
            params.bboxEast !== undefined &&
            params.bboxWest !== undefined
        ) {
            whereClauses.push(
                sql`(${accommodations.location}->'coordinates'->>'lat')::numeric BETWEEN ${params.bboxSouth} AND ${params.bboxNorth}`
            );
            whereClauses.push(
                sql`(${accommodations.location}->'coordinates'->>'long')::numeric BETWEEN ${params.bboxWest} AND ${params.bboxEast}`
            );
        }

        // Geo radius filter — see countByFilters() for rationale.
        if (
            params.latitude !== undefined &&
            params.longitude !== undefined &&
            params.radius !== undefined
        ) {
            whereClauses.push(
                buildGeoRadiusClause(params.latitude, params.longitude, params.radius)
            );
        }

        const where = and(...whereClauses);

        const orderBy = buildAccommodationOrderBy({
            featuredFirst: params.featuredFirst,
            sorts: params.sorts,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
            latitude: params.latitude,
            longitude: params.longitude
        });

        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;

        const resultsQuery = db
            .select()
            .from(this.table)
            .where(where)
            .orderBy(...orderBy)
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const totalQuery = db.select({ count: count() }).from(this.table).where(where);

        const [items, totalResult] = await Promise.all([resultsQuery, totalQuery]);
        const total = Number(totalResult[0]?.count ?? 0);

        // DRIZZLE-LIMITATION: Drizzle's select() returns inferred row type with branded enum/JSONB columns; entity type uses unbranded domain types from @repo/schemas.
        return { items: items as unknown as Accommodation[], total };
    }

    /**
     * Search accommodations with destination and owner relations
     */
    public async searchWithRelations(
        params: AccommodationSearchInput & {
            excludeRestricted?: boolean;
            excludeOwnerSuspended?: boolean;
            /** SPEC-167 T-004: exclude plan-restricted accommodations from public searches. */
            excludePlanRestricted?: boolean;
            /** Restrict results to ACTIVE lifecycle state (excludes DRAFT, INACTIVE, ARCHIVED). */
            activeOnly?: boolean;
        },
        tx?: DrizzleClient
    ): Promise<{
        items: Array<
            Accommodation & {
                destination?: DestinationSummary;
                owner?: UserSummary;
            }
        >;
        total: number;
    }> {
        const db = this.getClient(tx);

        const whereClauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];
        if (params.ownerId) {
            whereClauses.push(eq(accommodations.ownerId, params.ownerId));
        }
        if (params.types && params.types.length > 0) {
            whereClauses.push(
                inArray(accommodations.type, params.types as (typeof accommodations.type._.data)[])
            );
        } else if (params.type) {
            whereClauses.push(eq(accommodations.type, params.type));
        }
        whereClauses.push(...buildBasePriceConditions(params.minPrice, params.maxPrice));
        if (params.destinationIds && params.destinationIds.length > 0) {
            whereClauses.push(inArray(accommodations.destinationId, params.destinationIds));
        } else if (params.destinationId) {
            whereClauses.push(eq(accommodations.destinationId, params.destinationId));
        }
        if (params.excludeRestricted) {
            whereClauses.push(ne(accommodations.visibility, 'RESTRICTED'));
        }
        if (params.excludeOwnerSuspended) {
            whereClauses.push(eq(accommodations.ownerSuspended, false));
        }
        // SPEC-167 T-004: plan-restricted accommodations are hidden from public reads.
        if (params.excludePlanRestricted) {
            whereClauses.push(eq(accommodations.planRestricted, false));
        }
        // Restrict to ACTIVE lifecycle state for public reads.
        // When true, excludes DRAFT, INACTIVE, and ARCHIVED accommodations.
        if (params.activeOnly) {
            whereClauses.push(eq(accommodations.lifecycleState, 'ACTIVE'));
        }
        if (params.minGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int >= ${params.minGuests}`
            );
        }
        if (params.maxGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int <= ${params.maxGuests}`
            );
        }
        if (params.minBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int >= ${params.minBedrooms}`
            );
        }
        if (params.maxBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int <= ${params.maxBedrooms}`
            );
        }
        if (params.minBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int >= ${params.minBathrooms}`
            );
        }
        if (params.maxBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int <= ${params.maxBathrooms}`
            );
        }
        if (params.minRating !== undefined) {
            whereClauses.push(gte(accommodations.averageRating, params.minRating));
        }
        if (params.amenities && params.amenities.length > 0) {
            // Intersection semantics: accommodation must have ALL provided amenity IDs.
            whereClauses.push(buildAmenityIntersectionClause(params.amenities));
        }
        if (params.anyAmenityGroups && params.anyAmenityGroups.length > 0) {
            // OR within each inner array (any variant counts), AND across
            // groups (each toggle is enforced independently). An empty inner
            // array means "the toggle was active but none of its canonical
            // slugs exist in the catalog" — match nothing, not everything.
            for (const group of params.anyAmenityGroups) {
                if (group.length === 0) {
                    whereClauses.push(sql<unknown>`FALSE`);
                } else {
                    whereClauses.push(buildAnyAmenityClause(group));
                }
            }
        }
        if (params.features && params.features.length > 0) {
            // Intersection semantics: accommodation must have ALL provided feature IDs.
            whereClauses.push(buildFeatureIntersectionClause(params.features));
        }
        if (params.q) {
            whereClauses.push(
                or(
                    safeIlike(accommodations.name, params.q),
                    safeIlike(accommodations.description, params.q)
                ) as SQL<unknown>
            );
        }

        // SPEC-097 — Viewport bbox filter on EXACT coordinates stored under
        // location.coordinates (JSONB). Public response still returns only
        // approximateLocation; the precise count happens server-side here.
        if (
            params.bboxNorth !== undefined &&
            params.bboxSouth !== undefined &&
            params.bboxEast !== undefined &&
            params.bboxWest !== undefined
        ) {
            whereClauses.push(
                sql`(${accommodations.location}->'coordinates'->>'lat')::numeric BETWEEN ${params.bboxSouth} AND ${params.bboxNorth}`
            );
            whereClauses.push(
                sql`(${accommodations.location}->'coordinates'->>'long')::numeric BETWEEN ${params.bboxWest} AND ${params.bboxEast}`
            );
        }

        // Geo radius filter — see countByFilters() for rationale.
        if (
            params.latitude !== undefined &&
            params.longitude !== undefined &&
            params.radius !== undefined
        ) {
            whereClauses.push(
                buildGeoRadiusClause(params.latitude, params.longitude, params.radius)
            );
        }

        const where = and(...whereClauses);

        const orderBy = buildAccommodationOrderBy({
            featuredFirst: params.featuredFirst,
            sorts: params.sorts,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
            latitude: params.latitude,
            longitude: params.longitude
        });

        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;

        // Get accommodations with relations (RQB API — `orderBy` is a bare array
        // property, NOT spread; spread inside an object literal is a SyntaxError).
        const results = await db.query.accommodations.findMany({
            where,
            with: {
                destination: {
                    columns: {
                        id: true,
                        name: true,
                        slug: true,
                        summary: true,
                        // Required by CityDestinationRefSchema (SPEC-095) so the
                        // service-layer `cityDestination` projection succeeds.
                        // Without these the safeParse fails silently and cards
                        // render an empty city badge.
                        destinationType: true,
                        level: true,
                        path: true,
                        pathIds: true,
                        isFeatured: true,
                        reviewsCount: true,
                        averageRating: true,
                        accommodationsCount: true,
                        media: true,
                        location: true
                    }
                },
                owner: {
                    columns: {
                        id: true,
                        displayName: true,
                        firstName: true,
                        lastName: true,
                        // Both sources are loaded so the service-layer
                        // projectAccommodationOwnerAvatar projection can
                        // prefer `image` (social login / upload) and fall
                        // back to `profile.avatar` (seed fixtures).
                        image: true,
                        profile: true,
                        role: true,
                        lifecycleState: true,
                        createdAt: true
                    }
                },
                // Optional projections, opt-in via params. Same nested
                // junction shape that `findTopRated` uses, which the web's
                // `extractRelationItems(item.amenities, 'amenity')` expects.
                // Drizzle expands these via lateral joins in a single query,
                // so pagination on the outer accommodations stays correct.
                ...(params.includeAmenities ? { amenities: { with: { amenity: true } } } : {}),
                ...(params.includeFeatures ? { features: { with: { feature: true } } } : {})
            },
            orderBy,
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        // Get total count
        const totalQuery = db.select({ count: count() }).from(this.table).where(where);
        const totalResult = await totalQuery;

        return {
            // DRIZZLE-LIMITATION: findMany with `with: { destination, owner }` returns nested relation shape; entity type uses optional summary types narrower than full Drizzle inferred relations.
            items: results as unknown as Array<
                Accommodation & {
                    destination?: DestinationSummary;
                    owner?: UserSummary;
                }
            >,
            total: Number(totalResult[0]?.count ?? 0)
        };
    }

    /**
     * Finds top-rated accommodations with optional filters and relations loaded.
     * Orders by averageRating DESC then reviewsCount DESC and limits the result size.
     *
     * Optimized to load all relations in a single query using Drizzle's `with` clause.
     */
    public async findTopRated(
        params: {
            limit?: number;
            destinationId?: string;
            type?: string;
            onlyFeatured?: boolean;
            excludeRestricted?: boolean;
            excludeOwnerSuspended?: boolean;
            /** SPEC-167 T-004: exclude plan-restricted accommodations from public top-rated lists. */
            excludePlanRestricted?: boolean;
            /** Restrict results to ACTIVE lifecycle state (excludes DRAFT, INACTIVE, ARCHIVED). */
            activeOnly?: boolean;
        },
        tx?: DrizzleClient
    ): Promise<Accommodation[]> {
        const db = this.getClient(tx);
        const {
            limit = 10,
            destinationId,
            type,
            onlyFeatured = false,
            excludeRestricted = false,
            excludeOwnerSuspended = false,
            excludePlanRestricted = false,
            activeOnly = false
        } = params ?? {};

        // Single query with all relations loaded via Drizzle's `with` clause
        const results = await db.query.accommodations.findMany({
            where: (fields, { eq, ne: neOp, isNull: isNullOp }) => {
                const clauses: SQL<unknown>[] = [isNullOp(fields.deletedAt)];
                if (destinationId) clauses.push(eq(fields.destinationId, destinationId));
                // DRIZZLE-LIMITATION: Domain enum (string union) and Drizzle column's branded pgEnum type differ at TS level but are identical at runtime.
                if (type) clauses.push(eq(fields.type, type as unknown as typeof fields.type));
                if (onlyFeatured) clauses.push(eq(fields.isFeatured, true));
                if (excludeRestricted) clauses.push(neOp(fields.visibility, 'RESTRICTED'));
                if (excludeOwnerSuspended) clauses.push(eq(fields.ownerSuspended, false));
                // SPEC-167 T-004: plan-restricted accommodations are hidden from public reads.
                if (excludePlanRestricted) clauses.push(eq(fields.planRestricted, false));
                // Restrict to ACTIVE lifecycle state for public reads.
                if (activeOnly) clauses.push(eq(fields.lifecycleState, 'ACTIVE'));
                return and(...clauses);
            },
            with: {
                destination: true,
                amenities: { with: { amenity: true } },
                features: { with: { feature: true } }
            },
            orderBy: [desc(accommodations.averageRating), desc(accommodations.reviewsCount)],
            limit
        });

        // DRIZZLE-LIMITATION: findMany with `with: { destination, amenities, features }` returns nested join shape; Accommodation entity flattens/renames these relations via schema.
        return results as unknown as Accommodation[];
    }

    /**
     * Updates the stats (reviewsCount, averageRating, rating) for the accommodation.
     */
    async updateStats(
        accommodationId: string,
        stats: { reviewsCount: number; averageRating: number; rating: AccommodationRatingInput },
        tx?: DrizzleClient
    ): Promise<void> {
        await this.update(
            { id: accommodationId },
            {
                reviewsCount: stats.reviewsCount,
                averageRating: stats.averageRating,
                rating: stats.rating
            },
            tx
        );
    }

    /**
     * Finds an accommodation with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { destination: true })
     * @returns Promise resolving to the accommodation with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<Accommodation | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            // Build the `with` object from the requested relations. 'faqs' was
            // previously unsupported here (only `destination` was handled), so
            // getFaqs() silently fell back to findOne and returned no FAQs (SPEC-158).
            const withObj: Record<string, boolean> = {};
            for (const key of ['destination', 'faqs']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                // Build the final `with` config: if `faqs` was requested, apply
                // display_order ASC NULLS LAST, created_at ASC ordering (SPEC-177 T-012).
                // biome-ignore lint/suspicious/noExplicitAny: Drizzle relational orderBy callback fields type is inferred at runtime; we use `any` solely for the config object shape
                const withConfig: Record<string, any> = { ...withObj };
                if (withObj.faqs) {
                    withConfig.faqs = {
                        where: (
                            fields: { deletedAt: AnyColumn },
                            { isNull }: { isNull: (col: AnyColumn) => unknown }
                        ) => isNull(fields.deletedAt),
                        orderBy: (fields: { displayOrder: AnyColumn; createdAt: AnyColumn }) => [
                            sql`${fields.displayOrder} ASC NULLS LAST`,
                            asc(fields.createdAt)
                        ]
                    };
                }
                const result = await db.query.accommodations.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withConfig
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                // DRIZZLE-LIMITATION: findFirst with relations returns nested relation shape; Accommodation entity type from @repo/schemas differs structurally.
                return result as unknown as Accommodation | null;
            }
            const result = await this.findOne(where, tx);
            logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findWithRelations', { where, relations }, error as Error);
            throw new DbError(
                this.entityName,
                'findWithRelations',
                { where, relations },
                (error as Error).message
            );
        }
    }

    /**
     * Returns the IDs of all non-deleted accommodations owned by a given user.
     *
     * Intended for service-layer scoping (e.g. conversation response-rate KPIs)
     * where only the IDs are needed, avoiding the overhead of hydrating full
     * accommodation rows.
     *
     * @param ownerId - UUID of the accommodation owner.
     * @param tx - Optional Drizzle transaction client.
     * @returns Array of accommodation UUID strings (may be empty).
     */
    async findIdsByOwnerId(ownerId: string, tx?: DrizzleClient): Promise<string[]> {
        const db = this.getClient(tx);
        const ctx = { ownerId };
        try {
            const rows = await db
                .select({ id: accommodations.id })
                .from(accommodations)
                .where(and(eq(accommodations.ownerId, ownerId), isNull(accommodations.deletedAt)));

            const ids = rows.map((r) => r.id);
            logQuery(this.entityName, 'findIdsByOwnerId', ctx, { count: ids.length });
            return ids;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findIdsByOwnerId', ctx, err);
            throw new DbError(this.entityName, 'findIdsByOwnerId', ctx, err.message);
        }
    }

    /**
     * Per-accommodation market comparison for the HOST card J redesign.
     *
     * For each of the owner's active accommodations, returns the listing's
     * own rating + review count alongside the average rating + total
     * review count of every other active accommodation in the same
     * destination. The widget uses these pairs to draw a "you vs
     * destination" indicator per row.
     *
     * (Price comparison was considered but skipped — `accommodations.price`
     * is stored as JSONB with currency + modifier metadata, so aggregating
     * across listings is not a straight `AVG()`. A future redesign can
     * surface price once we expose a `base_amount_centavos` projection.)
     *
     * Returns an empty array immediately when the owner has zero
     * accommodations.
     *
     * @param ownerId - The host's user id.
     * @param tx - Optional Drizzle transaction client.
     */
    async getMarketComparisonByOwnerId(
        ownerId: string,
        tx?: DrizzleClient
    ): Promise<
        ReadonlyArray<{
            readonly accommodationId: string;
            readonly accommodationName: string;
            readonly accommodationType: string;
            readonly destinationId: string;
            readonly destinationName: string | null;
            readonly yourRating: number | null;
            readonly yourReviews: number;
            readonly destinationAvgRating: number | null;
            readonly destinationReviewsTotal: number;
            readonly yourPrice: number | null;
            readonly destinationAvgPrice: number | null;
        }>
    > {
        const db = this.getClient(tx);
        const ctx = { ownerId };

        try {
            // Correlated sub-queries for the destination averages.
            // Average rating is computed only over listings with ≥1 review
            // so the mean reflects actual signal, not noise.
            const ratedListingsForDestination = sql<number | null>`
                (
                    SELECT AVG(a2.average_rating)::float
                    FROM ${accommodations} a2
                    WHERE a2.destination_id = ${accommodations.destinationId}
                      AND a2.lifecycle_state = 'ACTIVE'
                      AND a2.deleted_at IS NULL
                      AND a2.reviews_count > 0
                )
            `;
            const reviewsTotalForDestination = sql<number | null>`
                (
                    SELECT SUM(a2.reviews_count)::int
                    FROM ${accommodations} a2
                    WHERE a2.destination_id = ${accommodations.destinationId}
                      AND a2.lifecycle_state = 'ACTIVE'
                      AND a2.deleted_at IS NULL
                )
            `;
            // Price is stored as JSONB { price: number, currency, ... }.
            // We extract the numeric base price for the host's listing and
            // for the destination average using the same JSONB cast the sort
            // helpers in this file already use (see buildPriceOrderExpr).
            // Price average is filtered by `type` so a "Casa quinta para 30"
            // doesn't get compared against a "Monoambiente para 1".
            const yourPrice = sql<number | null>`
                (${accommodations.price}->>'price')::numeric
            `;
            const avgPriceForDestinationAndType = sql<number | null>`
                (
                    SELECT AVG((a2.price->>'price')::numeric)
                    FROM ${accommodations} a2
                    WHERE a2.destination_id = ${accommodations.destinationId}
                      AND a2.type = ${accommodations.type}
                      AND a2.lifecycle_state = 'ACTIVE'
                      AND a2.deleted_at IS NULL
                      AND (a2.price->>'price') IS NOT NULL
                      AND (a2.price->>'price')::numeric > 0
                )
            `;

            const rows = await db
                .select({
                    accommodationId: accommodations.id,
                    accommodationName: accommodations.name,
                    accommodationType: accommodations.type,
                    destinationId: accommodations.destinationId,
                    destinationName: destinations.name,
                    yourRating: accommodations.averageRating,
                    yourReviews: accommodations.reviewsCount,
                    destinationAvgRating: ratedListingsForDestination,
                    destinationReviewsTotal: reviewsTotalForDestination,
                    yourPrice,
                    destinationAvgPrice: avgPriceForDestinationAndType
                })
                .from(accommodations)
                .leftJoin(destinations, eq(destinations.id, accommodations.destinationId))
                .where(
                    and(
                        eq(accommodations.ownerId, ownerId),
                        eq(accommodations.lifecycleState, 'ACTIVE'),
                        isNull(accommodations.deletedAt)
                    )
                )
                .orderBy(asc(accommodations.name))
                .limit(20);

            logQuery(this.entityName, 'getMarketComparisonByOwnerId', ctx, { count: rows.length });

            return rows.map((row) => ({
                accommodationId: row.accommodationId,
                accommodationName: row.accommodationName,
                accommodationType: row.accommodationType as string,
                destinationId: row.destinationId,
                destinationName: row.destinationName ?? null,
                yourRating: row.yourRating !== null ? Number(row.yourRating) : null,
                yourReviews: Number(row.yourReviews ?? 0),
                destinationAvgRating:
                    row.destinationAvgRating !== null ? Number(row.destinationAvgRating) : null,
                destinationReviewsTotal: Number(row.destinationReviewsTotal ?? 0),
                yourPrice: row.yourPrice !== null ? Number(row.yourPrice) : null,
                destinationAvgPrice:
                    row.destinationAvgPrice !== null ? Number(row.destinationAvgPrice) : null
            }));
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'getMarketComparisonByOwnerId', ctx, err);
            throw new DbError(this.entityName, 'getMarketComparisonByOwnerId', ctx, err.message);
        }
    }
}

/** Singleton instance of AccommodationModel for use across the application. */
export const accommodationModel = new AccommodationModel();
