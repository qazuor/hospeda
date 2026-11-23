/**
 * Unit coverage for `activeOwnedPartnerCondition` (HOS-2551).
 *
 * `/auth/me` reports `ownsPartner` from this predicate. A revoked partner and a
 * soft-deleted one must not count, and the lookup must key on the indexed
 * `owner_user_id` column.
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { activeOwnedPartnerCondition } from '../../src/models/partner/partner.model.ts';

const OWNER = '11111111-1111-4111-8111-111111111111';
const compile = () => new PgDialect().sqlToQuery(activeOwnedPartnerCondition(OWNER));

describe('activeOwnedPartnerCondition', () => {
    it('keys on the owner column', () => {
        // Act
        const { sql, params } = compile();

        // Assert
        expect(sql).toContain('"partners"."owner_user_id" = $1');
        expect(params).toEqual([OWNER]);
    });

    it('excludes a revoked partner', () => {
        // Act
        const { sql } = compile();

        // Assert
        expect(sql).toContain('"partners"."revoked_at" is null');
    });

    it('excludes a soft-deleted partner', () => {
        // Act
        const { sql } = compile();

        // Assert
        expect(sql).toContain('"partners"."deleted_at" is null');
    });
});
