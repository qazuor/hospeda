/**
 * Tests for SPEC-292 — buildAccommodationOrderBy: featuredByPlan OR disjunction.
 *
 * SPEC-292 changed the `featuredFirst` pin from ordering by `is_featured DESC`
 * alone to ordering by `(is_featured OR featured_by_plan) DESC`. This ensures
 * that plan-derived featured listings (featuredByPlan=true, isFeatured=false)
 * also sort to the top when featuredFirst is enabled.
 *
 * These tests extend the existing accommodation.order-by.test.ts by asserting
 * the SPEC-292-specific SQL change. They do NOT duplicate the general ordering
 * behavior already covered in the existing file.
 *
 * Coverage:
 * 1. featuredFirst pin references BOTH is_featured AND featured_by_plan
 *    (the OR disjunction is present in the rendered SQL).
 * 2. A listing with only featuredByPlan=true would sort above one with both
 *    false — asserted at the SQL expression level (the disjunction covers it).
 * 3. The pin retains DESC ordering (featured-first, not featured-last).
 * 4. The pin still comes before other sorts when combined with sorts[].
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

describe('SPEC-292 — buildAccommodationOrderBy with featuredFirst (OR disjunction)', () => {
    it('pin references featured_by_plan column in the SQL expression', () => {
        // Arrange & Act
        const orderBy = buildAccommodationOrderBy({ featuredFirst: true });
        const rendered = renderOrderBy(orderBy);

        // Assert — the first expression contains featured_by_plan
        // (SPEC-292: plan-derived featuring must be included in the sort pin)
        expect(rendered[0]).toMatch(/featured_by_plan/i);
    });

    it('pin references is_featured column in the SQL expression', () => {
        // Arrange & Act
        const orderBy = buildAccommodationOrderBy({ featuredFirst: true });
        const rendered = renderOrderBy(orderBy);

        // Assert — is_featured is still referenced (admin-curated featuring preserved)
        expect(rendered[0]).toMatch(/is_featured/i);
    });

    it('pin uses OR to combine is_featured and featured_by_plan', () => {
        // Arrange & Act
        const orderBy = buildAccommodationOrderBy({ featuredFirst: true });
        const rendered = renderOrderBy(orderBy);

        // Assert — OR disjunction is present so both manual and plan-derived
        // featured listings sort to the top
        expect(rendered[0]).toMatch(/\bOR\b/i);
    });

    it('pin uses DESC ordering (featured items sort first, not last)', () => {
        // Arrange & Act
        const orderBy = buildAccommodationOrderBy({ featuredFirst: true });
        const rendered = renderOrderBy(orderBy);

        // Assert — DESC ensures true values come before false
        expect(rendered[0]).toMatch(/desc/i);
    });

    it('pin still comes first when combined with other sorts', () => {
        // Arrange & Act
        const orderBy = buildAccommodationOrderBy({
            featuredFirst: true,
            sorts: [{ field: 'name', order: 'asc' }]
        });
        const rendered = renderOrderBy(orderBy);

        // Assert — three entries: [pin, name asc, id desc]
        expect(rendered).toHaveLength(3);
        // First entry has the OR disjunction (the featured pin)
        expect(rendered[0]).toMatch(/featured_by_plan/i);
        expect(rendered[0]).toMatch(/is_featured/i);
        // Second entry is the name sort
        expect(rendered[1]).toMatch(/"name" asc/i);
    });

    it('featuredByPlan-only listing would sort above neither-featured listing: disjunction covers it', () => {
        // This is a SQL-level assertion: the pin expression `(is_featured OR featured_by_plan) DESC`
        // means a row with featured_by_plan=true (isFeatured=false) evaluates to true and
        // sorts BEFORE a row where both are false. We assert the expression contains both
        // column references so the DB engine can apply the OR correctly.
        //
        // A runtime sort comparison is not possible without a live DB; the SQL expression
        // correctness is the verifiable unit here.

        // Arrange & Act
        const orderBy = buildAccommodationOrderBy({ featuredFirst: true });
        const rendered = renderOrderBy(orderBy);
        const pinExpression = rendered[0] ?? '';

        // Assert — BOTH columns are in the disjunction so a featuredByPlan=true row
        // is correctly treated as "featured" at sort time
        expect(pinExpression).toMatch(/is_featured/i);
        expect(pinExpression).toMatch(/featured_by_plan/i);
        expect(pinExpression).toMatch(/\bOR\b/i);
        expect(pinExpression).toMatch(/desc/i);
    });

    it('when featuredFirst is false, featured_by_plan does NOT appear in the ORDER BY', () => {
        // Arrange & Act — no featuredFirst flag; standard sort by name
        const orderBy = buildAccommodationOrderBy({ sorts: [{ field: 'name', order: 'asc' }] });
        const rendered = renderOrderBy(orderBy);

        // Assert — featured_by_plan only enters the ORDER BY via the pin; without it, absent
        const allRendered = rendered.join(' ');
        expect(allRendered).not.toMatch(/featured_by_plan/i);
    });
});
