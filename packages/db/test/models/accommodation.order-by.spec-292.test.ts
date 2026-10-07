/**
 * Tests for SPEC-292 — buildAccommodationOrderBy: the `featuredFirst` pin.
 *
 * SPEC-292 made the pin order by `(is_featured OR featured_by_entitlement) DESC`
 * so plan- and addon-derived featuring also sorts to the top. HOS-1419 dropped
 * the admin-curated `is_featured` column, so the pin now orders by
 * `featured_by_entitlement DESC` alone — the only featuring source left.
 *
 * Coverage:
 * 1. The pin references `featured_by_entitlement` and never `is_featured`.
 * 2. The pin keeps DESC ordering (featured-first, not featured-last).
 * 3. The pin comes before other sorts when combined with `sorts[]`.
 * 4. An `isFeatured` sort entry orders by `featured_by_entitlement` when not
 *    pinned, and is dropped when pinned (no duplicated featured ORDER BY).
 *
 * @module test/models/accommodation.order-by.spec-292
 */

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { buildAccommodationOrderBy } from '../../src/models/accommodation/accommodation.model';

/** Render Drizzle SQL expressions to plain SQL strings for semantic assertions. */
const dialect = new PgDialect();
function renderOrderBy(entries: readonly SQL[]): string[] {
    return entries.map((e) => dialect.sqlToQuery(e).sql);
}

describe('SPEC-292 — buildAccommodationOrderBy with featuredFirst', () => {
    it('pin references featured_by_entitlement and not the dropped is_featured', () => {
        // Arrange & Act
        const rendered = renderOrderBy(buildAccommodationOrderBy({ featuredFirst: true }));

        // Assert
        expect(rendered[0]).toMatch(/featured_by_entitlement/i);
        expect(rendered.join(' ')).not.toMatch(/is_featured/i);
    });

    it('pin uses DESC ordering (featured items sort first, not last)', () => {
        // Arrange & Act
        const rendered = renderOrderBy(buildAccommodationOrderBy({ featuredFirst: true }));

        // Assert
        expect(rendered[0]).toMatch(/desc/i);
    });

    it('pin still comes first when combined with other sorts', () => {
        // Arrange & Act
        const rendered = renderOrderBy(
            buildAccommodationOrderBy({
                featuredFirst: true,
                sorts: [{ field: 'name', order: 'asc' }]
            })
        );

        // Assert — three entries: [pin, name asc, id desc]
        expect(rendered).toHaveLength(3);
        expect(rendered[0]).toMatch(/featured_by_entitlement/i);
        expect(rendered[1]).toMatch(/"name" asc/i);
    });

    it('an isFeatured sort orders by featured_by_entitlement when not pinned', () => {
        // Arrange & Act
        const rendered = renderOrderBy(
            buildAccommodationOrderBy({ sorts: [{ field: 'isFeatured', order: 'desc' }] })
        );

        // Assert — [featured_by_entitlement desc, id desc]
        expect(rendered).toHaveLength(2);
        expect(rendered[0]).toMatch(/featured_by_entitlement/i);
    });

    it('an isFeatured sort is dropped when the pin is on (no duplicated featured ORDER BY)', () => {
        // Arrange & Act
        const rendered = renderOrderBy(
            buildAccommodationOrderBy({
                featuredFirst: true,
                sorts: [{ field: 'isFeatured', order: 'desc' }]
            })
        );

        // Assert — [pin, id desc]
        expect(rendered).toHaveLength(2);
    });

    it('when featuredFirst is false, featured_by_entitlement does NOT appear in the ORDER BY', () => {
        // Arrange & Act
        const rendered = renderOrderBy(
            buildAccommodationOrderBy({ sorts: [{ field: 'name', order: 'asc' }] })
        );

        // Assert
        expect(rendered.join(' ')).not.toMatch(/featured_by_entitlement/i);
    });
});
