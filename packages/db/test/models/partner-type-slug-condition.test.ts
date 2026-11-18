/**
 * Unit coverage for `partnerTypeSlugCondition` (HOS-2336 AC-5.2, AC-4.2).
 *
 * The filter `?type=<slug>` must match through the catalog (`type_id`), fall
 * back to the legacy enum column only for rows the backfill has not reached,
 * and compare on text so an unknown slug matches nothing instead of raising an
 * invalid-enum error.
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { partnerTypeSlugCondition } from '../../src/models/partner/partner.model.ts';

const compile = (slug: string) => new PgDialect().sqlToQuery(partnerTypeSlugCondition(slug));

describe('partnerTypeSlugCondition', () => {
    it('matches through the catalog by slug', () => {
        // Act
        const { sql, params } = compile('media');

        // Assert
        expect(sql).toContain('"partners"."type_id" IN (SELECT "partner_types"."id"');
        expect(sql).toContain('"partner_types"."slug" = $1');
        expect(params[0]).toBe('media');
    });

    it('falls back to the legacy column only for rows without type_id', () => {
        // Act
        const { sql, params } = compile('ngo');

        // Assert
        expect(sql).toContain('"partners"."type_id" IS NULL AND "partners"."type"::text = $2');
        expect(params).toEqual(['ngo', 'ngo']);
    });

    it('compares on text, so an unknown slug is a plain non-match (AC-5.2)', () => {
        // Act
        const { sql, params } = compile('not-a-type');

        // Assert
        expect(sql).not.toMatch(/::partner_type_enum/);
        expect(params).toEqual(['not-a-type', 'not-a-type']);
    });
});
