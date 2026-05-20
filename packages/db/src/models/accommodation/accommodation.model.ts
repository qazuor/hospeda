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
 */
function buildMostSavedOrderExpr(order: 'asc' | 'desc'): SQL {
    const direction = order === 'desc' ? sql`DESC` : sql`ASC`;
    return sql`(
        SELECT COUNT(*) FROM ${userBookmarks}
        WHERE ${userBookmarks.entityId} = ${accommodations.id}
          AND ${userBookmarks.entityType} = 'ACCOMMODATION'
          AND ${userBookmarks.deletedAt} IS NULL
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
 *   1. `featuredFirst` pin     → `isFeatured DESC` prepended.
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
}): SQL[] {
    const orderBy: SQL[] = [];

    if (params.featuredFirst) {
        orderBy.push(desc(accommodations.isFeatured));
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
     * The `media` column stores structured image metadata as JSONB.
     * Opting in here ensures that a partial media patch (e.g. updating only
     * `gallery`) does not overwrite sibling keys (e.g. `featuredImage`) that
     * were written by a concurrent request (GAP-078-186, GAP-078-198).
     */
    protected override readonly mergeableJsonbColumns = ['media'] as const;

    protected getTableName(): string {
        return 'accommodations';
    }

    public async countByFilters(
        params: AccommodationSearchInput & { excludeRestricted?: boolean },
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

        const where = and(...whereClauses);

        const totalQuery = db.select({ count: count() }).from(this.table).where(where);
        const totalResult = await totalQuery;
        return { count: Number(totalResult[0]?.count ?? 0) };
    }

    public async search(
        params: AccommodationSearchInput & { excludeRestricted?: boolean },
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

        const where = and(...whereClauses);

        const orderBy = buildAccommodationOrderBy({
            featuredFirst: params.featuredFirst,
            sorts: params.sorts,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder
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
        params: AccommodationSearchInput & { excludeRestricted?: boolean },
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

        const where = and(...whereClauses);

        const orderBy = buildAccommodationOrderBy({
            featuredFirst: params.featuredFirst,
            sorts: params.sorts,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder
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
                }
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
        },
        tx?: DrizzleClient
    ): Promise<Accommodation[]> {
        const db = this.getClient(tx);
        const {
            limit = 10,
            destinationId,
            type,
            onlyFeatured = false,
            excludeRestricted = false
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
            if (relations.destination) {
                const db = this.getClient(tx);
                const result = await db.query.accommodations.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: { destination: true }
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                // DRIZZLE-LIMITATION: findFirst with `with: { destination: true }` returns nested relation shape; Accommodation entity type from @repo/schemas differs structurally.
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
}

/** Singleton instance of AccommodationModel for use across the application. */
export const accommodationModel = new AccommodationModel();
