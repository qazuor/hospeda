/**
 * Guards for the venue business-line WHERE clause (HOS-1787 leaf 7.1).
 *
 * The admin listing filter is the only consumer. These tests compile the
 * clause through the real `PgDialect` and inspect the SQL text and bound
 * parameters; they do NOT execute it. Three properties matter:
 *
 * 1. **Absent line means no filter** — the caller passes the result straight
 *    through `additionalConditions`, so `undefined` must mean "no condition".
 * 2. **Containment, not equality** — `@>`, never `=`, because a listing with
 *    both lines must still match a filter for one of them.
 * 3. **The line is a bound parameter, never interpolated** — it arrives from a
 *    query string.
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { buildVenueBusinessLineCondition } from '../../../src/models/venue/venue-business-line-filter';

const dialect = new PgDialect();

describe('buildVenueBusinessLineCondition', () => {
    it('returns undefined when no line is requested', () => {
        expect(buildVenueBusinessLineCondition({})).toBeUndefined();
        expect(buildVenueBusinessLineCondition({ businessLine: undefined })).toBeUndefined();
    });

    it('uses array containment against the business_lines column', () => {
        const condition = buildVenueBusinessLineCondition({ businessLine: 'food' });
        expect(condition).toBeDefined();

        const { sql } = dialect.sqlToQuery(condition as never);

        expect(sql).toContain('@>');
        expect(sql).toContain('"venues"."business_lines"');
        expect(sql).not.toContain(' = ');
    });

    it('binds the requested line as a parameter instead of interpolating it', () => {
        const condition = buildVenueBusinessLineCondition({ businessLine: 'food' });

        const { sql, params } = dialect.sqlToQuery(condition as never);

        expect(sql).not.toContain('food');
        expect(params).toHaveLength(1);
        expect(String(params[0])).toContain('food');
    });

    it('keeps the line readable for nightlife too', () => {
        const condition = buildVenueBusinessLineCondition({ businessLine: 'nightlife' });

        const { sql, params } = dialect.sqlToQuery(condition as never);

        expect(sql).toContain('@>');
        expect(params).toHaveLength(1);
        expect(String(params[0])).toContain('nightlife');
    });
});
