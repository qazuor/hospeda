import type { SortField } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { buildAccommodationOrderBy } from '../../src/models/accommodation/accommodation.model';

/**
 * Render a list of Drizzle SQL expressions to plain SQL strings so we can make
 * semantic assertions (e.g. "contains NULLS LAST", "ends with id DESC") without
 * booting a real database. `dialect.sqlToQuery` accepts `SQL` instances; the
 * helper accepts `readonly SQL[]` to match the declared return type of
 * `buildAccommodationOrderBy`.
 */
const dialect = new PgDialect();
function renderOrderBy(entries: readonly SQL[]): string[] {
    return entries.map((e) => dialect.sqlToQuery(e).sql);
}

describe('buildAccommodationOrderBy', () => {
    it('returns only the stable tiebreaker when no params are provided', () => {
        const orderBy = buildAccommodationOrderBy({});
        expect(orderBy).toHaveLength(1);
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/"accommodations"."id" desc/i);
    });

    it('prepends (isFeatured OR featuredByPlan) DESC when featuredFirst is true', () => {
        const orderBy = buildAccommodationOrderBy({ featuredFirst: true });
        expect(orderBy).toHaveLength(2);
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/"is_featured".*\bor\b.*"featured_by_plan".*desc/i);
        expect(rendered[1]).toMatch(/"id" desc/i);
    });

    it('appends sorts[] in declared order then the tiebreaker', () => {
        const sorts: SortField[] = [
            { field: 'name', order: 'asc' },
            { field: 'createdAt', order: 'desc' }
        ];
        const orderBy = buildAccommodationOrderBy({ sorts });
        expect(orderBy).toHaveLength(3);
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/"name" asc/i);
        expect(rendered[1]).toMatch(/"created_at" desc/i);
        expect(rendered[2]).toMatch(/"id" desc/i);
    });

    it('dedups isFeatured entries within sorts[] when featuredFirst is true', () => {
        const sorts: SortField[] = [
            { field: 'isFeatured', order: 'asc' },
            { field: 'name', order: 'asc' }
        ];
        const orderBy = buildAccommodationOrderBy({ featuredFirst: true, sorts });
        expect(orderBy).toHaveLength(3);
        const rendered = renderOrderBy(orderBy);
        // Primary pin
        expect(rendered[0]).toMatch(/"is_featured".*\bor\b.*"featured_by_plan".*desc/i);
        // The in-sorts isFeatured was dropped — second position is name
        expect(rendered[1]).toMatch(/"name" asc/i);
        expect(rendered[2]).toMatch(/"id" desc/i);
        // No double is_featured anywhere
        const hits = rendered.filter((r) => /"is_featured"/i.test(r));
        expect(hits).toHaveLength(1);
    });

    it('falls back to sortBy/sortOrder when sorts[] is absent', () => {
        const orderBy = buildAccommodationOrderBy({ sortBy: 'name', sortOrder: 'desc' });
        expect(orderBy).toHaveLength(2);
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/"name" desc/i);
        expect(rendered[1]).toMatch(/"id" desc/i);
    });

    it('dedups legacy sortBy=isFeatured when featuredFirst is also true', () => {
        const orderBy = buildAccommodationOrderBy({
            featuredFirst: true,
            sortBy: 'isFeatured',
            sortOrder: 'asc'
        });
        expect(orderBy).toHaveLength(2);
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/"is_featured".*\bor\b.*"featured_by_plan".*desc/i);
        expect(rendered[1]).toMatch(/"id" desc/i);
        // No asc "is_featured" from the legacy fallback
        const hits = rendered.filter((r) => /"is_featured"/i.test(r));
        expect(hits).toHaveLength(1);
    });

    it('silently skips unknown sort fields (parity with legacy behavior)', () => {
        const sorts: SortField[] = [
            { field: 'thisDoesNotExist', order: 'asc' },
            { field: 'name', order: 'asc' }
        ];
        const orderBy = buildAccommodationOrderBy({ sorts });
        expect(orderBy).toHaveLength(2);
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/"name" asc/i);
        expect(rendered[1]).toMatch(/"id" desc/i);
    });

    it('honors 5-entry boundary (5 sorts → 6 total with tiebreaker)', () => {
        const sorts: SortField[] = [
            { field: 'name', order: 'asc' },
            { field: 'createdAt', order: 'asc' },
            { field: 'averageRating', order: 'desc' },
            { field: 'reviewsCount', order: 'desc' },
            { field: 'slug', order: 'asc' }
        ];
        const orderBy = buildAccommodationOrderBy({ sorts });
        expect(orderBy).toHaveLength(6);
    });

    it('emits NULLS LAST for averageRating (nullable numeric field)', () => {
        const sorts: SortField[] = [{ field: 'averageRating', order: 'desc' }];
        const orderBy = buildAccommodationOrderBy({ sorts });
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/NULLS LAST/i);
        expect(rendered[0]).toMatch(/DESC/i);
    });

    it('emits NULLS LAST for reviewsCount (nullable numeric field)', () => {
        const sorts: SortField[] = [{ field: 'reviewsCount', order: 'asc' }];
        const orderBy = buildAccommodationOrderBy({ sorts });
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/NULLS LAST/i);
    });

    it('skips minPrice/maxPrice silently — they are NULLABLE_FIELDS entries but not actual columns on the accommodations table (stored under `price` JSONB). Parity with unknown-column behavior.', () => {
        for (const field of ['minPrice', 'maxPrice'] as const) {
            const sorts: SortField[] = [{ field, order: 'asc' }];
            const orderBy = buildAccommodationOrderBy({ sorts });
            expect(orderBy).toHaveLength(1);
            const rendered = renderOrderBy(orderBy);
            expect(rendered[0]).toMatch(/"id" desc/i);
        }
    });

    it('does NOT emit NULLS LAST for non-nullable columns (e.g. name)', () => {
        const sorts: SortField[] = [{ field: 'name', order: 'asc' }];
        const orderBy = buildAccommodationOrderBy({ sorts });
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).not.toMatch(/NULLS LAST/i);
    });

    it('treats an empty sorts[] array as the legacy fallback path', () => {
        const orderBy = buildAccommodationOrderBy({
            sorts: [],
            sortBy: 'name',
            sortOrder: 'asc'
        });
        expect(orderBy).toHaveLength(2);
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/"name" asc/i);
        expect(rendered[1]).toMatch(/"id" desc/i);
    });

    it('prepends featuredFirst alongside sorts without dedup when no isFeatured entry is present', () => {
        const sorts: SortField[] = [{ field: 'averageRating', order: 'desc' }];
        const orderBy = buildAccommodationOrderBy({ featuredFirst: true, sorts });
        expect(orderBy).toHaveLength(3);
        const rendered = renderOrderBy(orderBy);
        expect(rendered[0]).toMatch(/"is_featured".*\bor\b.*"featured_by_plan".*desc/i);
        expect(rendered[1]).toMatch(/"average_rating"/i);
        expect(rendered[1]).toMatch(/NULLS LAST/i);
        expect(rendered[2]).toMatch(/"id" desc/i);
    });

    describe('distance sort (haversine)', () => {
        it('emits a haversine ORDER BY when distance is requested with a geo center', () => {
            const sorts: SortField[] = [{ field: 'distance', order: 'asc' }];
            const orderBy = buildAccommodationOrderBy({
                sorts,
                latitude: -32.4846,
                longitude: -58.2326
            });
            expect(orderBy).toHaveLength(2);
            const rendered = renderOrderBy(orderBy);
            // Haversine SQL contains asin / sqrt / radians and references the
            // JSONB coordinates path.
            expect(rendered[0]).toMatch(/asin/i);
            expect(rendered[0]).toMatch(/sqrt/i);
            expect(rendered[0]).toMatch(/radians/i);
            expect(rendered[0]).toMatch(/coordinates/i);
            expect(rendered[0]).toMatch(/NULLS LAST/i);
            expect(rendered[1]).toMatch(/"id" desc/i);
        });

        it('honors `desc` direction for distance (farthest first)', () => {
            const sorts: SortField[] = [{ field: 'distance', order: 'desc' }];
            const orderBy = buildAccommodationOrderBy({
                sorts,
                latitude: -32,
                longitude: -58
            });
            const rendered = renderOrderBy(orderBy);
            expect(rendered[0]).toMatch(/DESC/i);
        });

        it('silently drops distance when no geo center is supplied', () => {
            const sorts: SortField[] = [{ field: 'distance', order: 'asc' }];
            const orderBy = buildAccommodationOrderBy({ sorts });
            // Only the id tiebreaker survives.
            expect(orderBy).toHaveLength(1);
            const rendered = renderOrderBy(orderBy);
            expect(rendered[0]).toMatch(/"id" desc/i);
        });

        it('silently drops distance when only latitude (not longitude) is supplied', () => {
            const sorts: SortField[] = [{ field: 'distance', order: 'asc' }];
            const orderBy = buildAccommodationOrderBy({
                sorts,
                latitude: -32.4846
                // longitude intentionally omitted
            });
            expect(orderBy).toHaveLength(1);
        });

        it('works via the legacy sortBy/sortOrder fallback path', () => {
            const orderBy = buildAccommodationOrderBy({
                sortBy: 'distance',
                sortOrder: 'asc',
                latitude: -32.4846,
                longitude: -58.2326
            });
            expect(orderBy).toHaveLength(2);
            const rendered = renderOrderBy(orderBy);
            expect(rendered[0]).toMatch(/asin/i);
        });

        it('combines featuredFirst with distance — pin still wins', () => {
            const sorts: SortField[] = [{ field: 'distance', order: 'asc' }];
            const orderBy = buildAccommodationOrderBy({
                featuredFirst: true,
                sorts,
                latitude: -32.4846,
                longitude: -58.2326
            });
            expect(orderBy).toHaveLength(3);
            const rendered = renderOrderBy(orderBy);
            expect(rendered[0]).toMatch(/"is_featured".*\bor\b.*"featured_by_plan".*desc/i);
            expect(rendered[1]).toMatch(/asin/i);
            expect(rendered[2]).toMatch(/"id" desc/i);
        });
    });
});
