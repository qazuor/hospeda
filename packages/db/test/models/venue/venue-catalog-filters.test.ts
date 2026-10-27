/**
 * Guards for the gastronomy catalog-membership WHERE clauses (HOS-1054).
 *
 * ## What these assert, and what they cannot
 *
 * They compile each clause through the real `PgDialect` and inspect the SQL text
 * and bound parameters. That covers the three properties a wrong clause would
 * break silently:
 *
 * 1. **Intersection, not union.** `HAVING COUNT(DISTINCT ...) = N` with N equal
 *    to the number of ids requested. Drop the HAVING and the query answers "has
 *    ANY of these aptos", which for a celiac who also cannot have lactose means
 *    being shown a place that satisfies exactly one of the two.
 * 2. **The ids are BOUND parameters, never interpolated.** They arrive from a
 *    query string.
 * 3. **The junction columns are raw identifiers, never aliased to the outer
 *    table.** A Drizzle column reference inside the subquery would compile to
 *    `"venues"."feature_id"` and 500 at runtime.
 *
 * They do NOT execute the SQL — no database is involved here. That the clause
 * actually returns the right rows is the service/e2e layer's job.
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
    buildVenueAmenityIntersectionClause,
    buildVenueCatalogConditions,
    buildVenueFeatureIntersectionClause
} from '../../../src/models/venue/venue-catalog-filters';

const dialect = new PgDialect();

const compile = (clause: Parameters<typeof dialect.sqlToQuery>[0]) => dialect.sqlToQuery(clause);

const GLUTEN_FREE_ID = '11111111-1111-4111-8111-111111111111';
const LACTOSE_FREE_ID = '22222222-2222-4222-8222-222222222222';

describe('buildVenueFeatureIntersectionClause', () => {
    it('correlates the subquery against the venues table', () => {
        const { sql } = compile(buildVenueFeatureIntersectionClause([GLUTEN_FREE_ID]));

        expect(sql).toContain('"venues"."id" IN (');
        expect(sql).toContain('FROM "r_venue_feature"');
    });

    it('reads the junction columns as raw identifiers, not outer-table aliases', () => {
        const { sql } = compile(buildVenueFeatureIntersectionClause([GLUTEN_FREE_ID]));

        expect(sql).toContain('"r_venue_feature"."venue_id"');
        expect(sql).toContain('"r_venue_feature"."feature_id"');
        // The failure mode this exists for: Drizzle aliasing a column reference
        // inside the subquery against the OUTER query's table.
        expect(sql).not.toContain('"venues"."feature_id"');
    });

    it('requires ALL requested features — HAVING COUNT equals the id count', () => {
        const { sql, params } = compile(
            buildVenueFeatureIntersectionClause([GLUTEN_FREE_ID, LACTOSE_FREE_ID])
        );

        expect(sql).toContain('HAVING COUNT(DISTINCT "r_venue_feature"."feature_id") =');
        // The count is the LAST bound param, after the two ids.
        expect(params).toEqual([GLUTEN_FREE_ID, LACTOSE_FREE_ID, 2]);
    });

    it('binds the ids as parameters instead of interpolating them', () => {
        const { sql, params } = compile(buildVenueFeatureIntersectionClause([GLUTEN_FREE_ID]));

        expect(sql).not.toContain(GLUTEN_FREE_ID);
        expect(params).toContain(GLUTEN_FREE_ID);
    });
});

describe('buildVenueAmenityIntersectionClause', () => {
    it('targets the amenity junction with the same intersection semantics', () => {
        const { sql, params } = compile(
            buildVenueAmenityIntersectionClause([GLUTEN_FREE_ID, LACTOSE_FREE_ID])
        );

        expect(sql).toContain('FROM "r_venue_amenity"');
        expect(sql).toContain('"r_venue_amenity"."amenity_id"');
        expect(sql).toContain('HAVING COUNT(DISTINCT "r_venue_amenity"."amenity_id") =');
        expect(params).toEqual([GLUTEN_FREE_ID, LACTOSE_FREE_ID, 2]);
    });
});

describe('buildVenueCatalogConditions', () => {
    it('returns nothing when neither filter is present', () => {
        expect(buildVenueCatalogConditions({})).toEqual([]);
    });

    it('treats an empty array as "no filter", not as "match nothing"', () => {
        // A stray `?features=` must not compile to `HAVING COUNT(...) = 0`, which
        // matches no row at all and would blank the listing.
        expect(buildVenueCatalogConditions({ features: [], amenities: [] })).toEqual([]);
    });

    it('emits one condition per active filter', () => {
        expect(buildVenueCatalogConditions({ features: [GLUTEN_FREE_ID] })).toHaveLength(1);
        expect(buildVenueCatalogConditions({ amenities: [GLUTEN_FREE_ID] })).toHaveLength(1);
        expect(
            buildVenueCatalogConditions({
                features: [GLUTEN_FREE_ID],
                amenities: [LACTOSE_FREE_ID]
            })
        ).toHaveLength(2);
    });

    it('puts the amenity condition before the feature condition', () => {
        const [first, second] = buildVenueCatalogConditions({
            features: [GLUTEN_FREE_ID],
            amenities: [LACTOSE_FREE_ID]
        });

        expect(compile(first as never).sql).toContain('"r_venue_amenity"');
        expect(compile(second as never).sql).toContain('"r_venue_feature"');
    });
});
