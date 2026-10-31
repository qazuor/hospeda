/**
 * @file accommodation-search-filters.ts
 * @description The ONE place the accommodation listing's WHERE clause is built.
 *
 * `AccommodationModel.search`, `.searchWithRelations` and `.countByFilters` used
 * to each carry a private copy of this chain. A filter wired into two of the
 * three answered 200 and silently ignored the third (HOS-1898 `isFeatured`,
 * HOS-1922 `isAvailable`/`city`/`country`). All three now call
 * {@link buildAccommodationSearchConditions}, so a filter is wired once or not
 * at all.
 *
 * {@link ACCOMMODATION_SEARCH_FILTER_HANDLING} is the compile-time ledger: it is
 * a `Record` over every key of `AccommodationSearchInput`, so adding a param to
 * the search schema fails typecheck until someone says where it is handled. The
 * companion test renders SQL to check that each claim is true.
 *
 * Lives under `models/`, not `utils/`: it imports dbschemas (see the note in
 * `venue-catalog-filters.ts` about the schema-free utils barrel).
 */

import type { AccommodationSearchInput } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { accommodationOccupancy } from '../../schemas/accommodation/accommodationOccupancy.dbschema.ts';
import { rAccommodationAmenity } from '../../schemas/accommodation/r_accommodation_amenity.dbschema.ts';
import { rAccommodationFeature } from '../../schemas/accommodation/r_accommodation_feature.dbschema.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { buildJsonbCoordinateExprs, buildWithinRadiusClause } from '../../utils/geo.ts';

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
 * strings) and are cast to numeric on the fly. Delegates to the shared
 * `@repo/db` geo helpers (HOS-111 T-010 — see `utils/geo.ts`) so this formula
 * is defined exactly once across accommodation and destination geo queries.
 */
function buildGeoRadiusClause(
    centerLat: number,
    centerLong: number,
    radiusKm: number
): SQL<unknown> {
    const { latExpr, longExpr } = buildJsonbCoordinateExprs(accommodations.location);
    return buildWithinRadiusClause({
        latCol: latExpr,
        longCol: longExpr,
        lat: centerLat,
        long: centerLong,
        radiusKm
    });
}

/**
 * Build the correlated `NOT EXISTS` clause used to exclude accommodations
 * with a blocked day anywhere inside `[checkIn, checkOut)` (HOS-43 Phase 1).
 * Only called once the caller has verified BOTH dates are present — see the
 * `params.checkIn && params.checkOut` guard at each call site.
 *
 * Half-open range: `date >= checkIn AND date < checkOut`. The checkout day
 * itself is deliberately excluded — hotel semantics treat checkout as
 * "vacating", so an accommodation occupied 10→12 is free again for a search
 * of checkIn=12 / checkOut=13.
 *
 * `checkIn`/`checkOut` arrive as `Date` objects (the HTTP layer coerces the
 * `YYYY-MM-DD` query param via `z.coerce.date()`). They are normalized to
 * canonical UTC `YYYY-MM-DD` strings before binding as SQL parameters — `pg`'s
 * default `Date` serialization uses the process's LOCAL timezone getters,
 * which can silently shift the bound day by ±1 depending on the server's `TZ`
 * (a UTC-midnight `Date` serialized from a process running in `UTC-3`
 * resolves to the previous local day). Binding a canonical date string
 * sidesteps that landmine entirely; the target column is a native Postgres
 * `date`, so the implicit text→date cast on either bound is exact.
 *
 * Follows the same `FROM ${table} alias` + raw `alias.column` convention as
 * the correlated subqueries in {@link AccommodationModel.getMarketComparisonByOwnerId}
 * rather than the `${column}`-template-ref workaround documented on
 * {@link buildAmenityIntersectionClause} — there is no lateral-join
 * re-aliasing risk here because the subquery's own columns are never
 * expressed as typed Drizzle column refs, only the outer correlation
 * (`${accommodations.id}`) and the two bound date params are.
 */
function buildOccupancyAvailabilityClause(checkIn: Date, checkOut: Date): SQL<unknown> {
    const checkInDate = checkIn.toISOString().slice(0, 10);
    const checkOutDate = checkOut.toISOString().slice(0, 10);
    return sql<unknown>`NOT EXISTS (
        SELECT 1 FROM ${accommodationOccupancy} ao
        WHERE ao.accommodation_id = ${accommodations.id}
          AND ao.date >= ${checkInDate}
          AND ao.date < ${checkOutDate}
          AND ao.is_blocked = true
    )`;
}

/**
 * Search input plus the server-side-only `publishedOnly` switch.
 *
 * HOS-1641 (V6.9b): `publishedOnly` restricts to `publicationStatus = PUBLISHED`,
 * the only state anybody but the owner or the admin may see (AC:V5:5).
 */
export type AccommodationSearchFilterInput = AccommodationSearchInput & {
    readonly publishedOnly?: boolean;
};

/** `extraInfo` JSONB integer bounds: schema param, JSONB key, comparison. */
const EXTRA_INFO_BOUNDS = [
    ['minGuests', 'capacity', '>='],
    ['maxGuests', 'capacity', '<='],
    ['minBedrooms', 'bedrooms', '>='],
    ['maxBedrooms', 'bedrooms', '<='],
    ['minBathrooms', 'bathrooms', '>='],
    ['maxBathrooms', 'bathrooms', '<=']
] as const;

/**
 * Builds every WHERE condition of the accommodation listing, soft-delete first.
 * Shared by `search`, `searchWithRelations` and `countByFilters` so the page and
 * its total can never disagree about which filters apply.
 *
 * @param input - Object wrapper (RO-RO).
 * @param input.params - Search input, optionally with `publishedOnly`.
 * @returns The conditions to `and(...)` together.
 */
export function buildAccommodationSearchConditions({
    params
}: {
    readonly params: AccommodationSearchFilterInput;
}): SQL<unknown>[] {
    const clauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];

    if (params.ownerId) {
        clauses.push(eq(accommodations.ownerId, params.ownerId));
    }
    if (params.types && params.types.length > 0) {
        clauses.push(
            inArray(accommodations.type, params.types as (typeof accommodations.type._.data)[])
        );
    } else if (params.type) {
        clauses.push(eq(accommodations.type, params.type));
    }
    clauses.push(...buildBasePriceConditions(params.minPrice, params.maxPrice));
    if (params.destinationIds && params.destinationIds.length > 0) {
        clauses.push(inArray(accommodations.destinationId, params.destinationIds));
    } else if (params.destinationId) {
        clauses.push(eq(accommodations.destinationId, params.destinationId));
    }
    if (params.publishedOnly) {
        clauses.push(eq(accommodations.publicationStatus, 'PUBLISHED'));
    }
    // HOS-1898: `?isFeatured=` narrows on the single featuring source column.
    if (params.isFeatured !== undefined) {
        clauses.push(eq(accommodations.featuredByEntitlement, params.isFeatured));
    }
    for (const [param, key, operator] of EXTRA_INFO_BOUNDS) {
        const value = params[param];
        if (value !== undefined) {
            clauses.push(
                sql`(${accommodations.extraInfo}->>${sql.raw(`'${key}'`)})::int ${sql.raw(operator)} ${value}`
            );
        }
    }
    if (params.minRating !== undefined) {
        clauses.push(gte(accommodations.averageRating, params.minRating));
    }
    if (params.maxRating !== undefined) {
        clauses.push(lte(accommodations.averageRating, params.maxRating));
    }
    if (params.amenities && params.amenities.length > 0) {
        // Intersection semantics: accommodation must have ALL provided amenity IDs.
        clauses.push(buildAmenityIntersectionClause(params.amenities));
    }
    if (params.anyAmenityGroups && params.anyAmenityGroups.length > 0) {
        // OR within each inner array (any variant counts), AND across groups
        // (each toggle is enforced independently). An empty inner array means
        // "the toggle was active but none of its canonical slugs exist in the
        // catalog" — match nothing, not everything.
        for (const group of params.anyAmenityGroups) {
            clauses.push(group.length === 0 ? sql<unknown>`FALSE` : buildAnyAmenityClause(group));
        }
    }
    if (params.features && params.features.length > 0) {
        // Intersection semantics: accommodation must have ALL provided feature IDs.
        clauses.push(buildFeatureIntersectionClause(params.features));
    }
    if (params.q) {
        clauses.push(
            or(
                safeIlike(accommodations.name, params.q),
                safeIlike(accommodations.description, params.q)
            ) as SQL<unknown>
        );
    }

    // SPEC-097 — viewport bbox on EXACT coordinates under location.coordinates
    // (JSONB). Needs all four edges.
    if (
        params.bboxNorth !== undefined &&
        params.bboxSouth !== undefined &&
        params.bboxEast !== undefined &&
        params.bboxWest !== undefined
    ) {
        clauses.push(
            sql`(${accommodations.location}->'coordinates'->>'lat')::numeric BETWEEN ${params.bboxSouth} AND ${params.bboxNorth}`
        );
        clauses.push(
            sql`(${accommodations.location}->'coordinates'->>'long')::numeric BETWEEN ${params.bboxWest} AND ${params.bboxEast}`
        );
    }

    // Geo radius — haversine km from the centre. Needs the full triplet;
    // partial input is ignored.
    if (
        params.latitude !== undefined &&
        params.longitude !== undefined &&
        params.radius !== undefined
    ) {
        clauses.push(buildGeoRadiusClause(params.latitude, params.longitude, params.radius));
    }

    // HOS-43 — occupancy availability. Needs BOTH dates; a lone checkIn or
    // checkOut is ignored so pre-HOS-43 callers keep working.
    if (params.checkIn && params.checkOut) {
        clauses.push(buildOccupancyAvailabilityClause(params.checkIn, params.checkOut));
    }

    return clauses;
}

/**
 * Convenience wrapper: the conditions of {@link buildAccommodationSearchConditions}
 * joined with `AND`.
 *
 * @param input - Object wrapper (RO-RO).
 * @param input.params - Search input, optionally with `publishedOnly`.
 * @returns The combined WHERE expression.
 */
export function buildAccommodationSearchWhere({
    params
}: {
    readonly params: AccommodationSearchFilterInput;
}): SQL<unknown> | undefined {
    return and(...buildAccommodationSearchConditions({ params }));
}

/** How a search param is honoured. See {@link ACCOMMODATION_SEARCH_FILTER_HANDLING}. */
export type AccommodationSearchFilterHandling =
    | {
          /** Narrows the rows inside {@link buildAccommodationSearchConditions}. */
          readonly kind: 'builder';
          /** A minimal input that must change the rendered SQL. */
          readonly sample: Partial<AccommodationSearchInput>;
      }
    | {
          /** Honoured outside the WHERE builder (ordering, projection, service). */
          readonly kind: 'elsewhere';
          readonly reason: string;
      }
    | {
          /**
           * Accepted by the schema but NOT implemented anywhere. Listing a key
           * here is the explicit, reviewable form of the bug this file exists to
           * prevent. The test pins that the builder really ignores it, so
           * implementing it forces the entry to move to `builder`.
           */
          readonly kind: 'known-gap';
          readonly sample: Partial<AccommodationSearchInput>;
          readonly reason: string;
      };

/**
 * Ledger of every `AccommodationSearchInput` key. A `Record` over the schema
 * keys: a new search param does not compile until it is classified here.
 */
export const ACCOMMODATION_SEARCH_FILTER_HANDLING: Readonly<
    Record<keyof AccommodationSearchInput, AccommodationSearchFilterHandling>
> = {
    page: { kind: 'elsewhere', reason: 'pagination (LIMIT/OFFSET in search)' },
    pageSize: { kind: 'elsewhere', reason: 'pagination (LIMIT/OFFSET in search)' },
    sortBy: { kind: 'elsewhere', reason: 'ORDER BY (buildAccommodationOrderBy)' },
    sortOrder: { kind: 'elsewhere', reason: 'ORDER BY (buildAccommodationOrderBy)' },
    sorts: { kind: 'elsewhere', reason: 'ORDER BY (buildAccommodationOrderBy)' },
    featuredFirst: { kind: 'elsewhere', reason: 'ORDER BY pin (buildAccommodationOrderBy)' },
    q: { kind: 'builder', sample: { q: 'casa' } },
    type: { kind: 'builder', sample: { type: 'HOTEL' } },
    types: { kind: 'builder', sample: { types: ['HOTEL'] } },
    isFeatured: { kind: 'builder', sample: { isFeatured: true } },
    minPrice: { kind: 'builder', sample: { minPrice: 10 } },
    maxPrice: { kind: 'builder', sample: { maxPrice: 10 } },
    currency: {
        kind: 'known-gap',
        sample: { currency: 'ARS' },
        reason: 'accepted by the schema, never read by the model (price is not currency-scoped)'
    },
    createdAfter: {
        kind: 'known-gap',
        sample: { createdAfter: new Date('2026-01-01') },
        reason: 'domain-schema only; no HTTP param feeds it and the model never reads it'
    },
    createdBefore: {
        kind: 'known-gap',
        sample: { createdBefore: new Date('2026-01-01') },
        reason: 'domain-schema only; no HTTP param feeds it and the model never reads it'
    },
    destinationId: {
        kind: 'builder',
        sample: { destinationId: '11111111-1111-4111-8111-111111111111' }
    },
    destinationIds: {
        kind: 'builder',
        sample: { destinationIds: ['11111111-1111-4111-8111-111111111111'] }
    },
    latitude: { kind: 'builder', sample: { latitude: -32.4, longitude: -58.2, radius: 5 } },
    longitude: { kind: 'builder', sample: { latitude: -32.4, longitude: -58.2, radius: 5 } },
    radius: { kind: 'builder', sample: { latitude: -32.4, longitude: -58.2, radius: 5 } },
    poiId: { kind: 'elsewhere', reason: 'resolved to latitude/longitude by the service' },
    poiSlug: { kind: 'elsewhere', reason: 'resolved to latitude/longitude by the service' },
    bboxNorth: {
        kind: 'builder',
        sample: { bboxNorth: 1, bboxSouth: 0, bboxEast: 1, bboxWest: 0 }
    },
    bboxSouth: {
        kind: 'builder',
        sample: { bboxNorth: 1, bboxSouth: 0, bboxEast: 1, bboxWest: 0 }
    },
    bboxEast: {
        kind: 'builder',
        sample: { bboxNorth: 1, bboxSouth: 0, bboxEast: 1, bboxWest: 0 }
    },
    bboxWest: {
        kind: 'builder',
        sample: { bboxNorth: 1, bboxSouth: 0, bboxEast: 1, bboxWest: 0 }
    },
    minGuests: { kind: 'builder', sample: { minGuests: 2 } },
    maxGuests: { kind: 'builder', sample: { maxGuests: 2 } },
    minBedrooms: { kind: 'builder', sample: { minBedrooms: 1 } },
    maxBedrooms: { kind: 'builder', sample: { maxBedrooms: 1 } },
    minBathrooms: { kind: 'builder', sample: { minBathrooms: 1 } },
    maxBathrooms: { kind: 'builder', sample: { maxBathrooms: 1 } },
    minRating: { kind: 'builder', sample: { minRating: 3 } },
    maxRating: { kind: 'builder', sample: { maxRating: 3 } },
    amenities: { kind: 'builder', sample: { amenities: ['11111111-1111-4111-8111-111111111111'] } },
    features: { kind: 'builder', sample: { features: ['11111111-1111-4111-8111-111111111111'] } },
    anyAmenityGroups: {
        kind: 'builder',
        sample: { anyAmenityGroups: [['11111111-1111-4111-8111-111111111111']] }
    },
    includeAmenities: { kind: 'elsewhere', reason: 'relation projection, not a row filter' },
    includeFeatures: { kind: 'elsewhere', reason: 'relation projection, not a row filter' },
    ownerId: { kind: 'builder', sample: { ownerId: '11111111-1111-4111-8111-111111111111' } },
    checkIn: {
        kind: 'builder',
        sample: { checkIn: new Date('2026-01-01'), checkOut: new Date('2026-01-03') }
    },
    checkOut: {
        kind: 'builder',
        sample: { checkIn: new Date('2026-01-01'), checkOut: new Date('2026-01-03') }
    }
};
