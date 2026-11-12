import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { accommodationExternalListings } from '../../src/schemas/accommodation-external/accommodation_external_listings.dbschema.ts';

/**
 * Regression guard for the external-listing platform uniqueness rule.
 *
 * The unique index used to cover soft-deleted rows too, so an owner who
 * removed a platform could never add it again: the INSERT always tripped the
 * same (accommodation, platform) constraint. The index must be partial on
 * `deleted_at IS NULL` so a live listing still occupies exactly one slot per
 * platform while a removed one frees it.
 */
describe('accommodationExternalListings schema', () => {
    it('enforces one ACTIVE listing per (accommodation, platform) with a partial unique index', () => {
        const { indexes } = getTableConfig(accommodationExternalListings);

        const uniqueIndex = indexes.find(
            (index) =>
                index.config.name === 'accommodation_external_listings_accommodation_platform_uniq'
        );

        expect(uniqueIndex).toBeDefined();
        expect(uniqueIndex?.config.unique).toBe(true);
        expect(uniqueIndex?.config.columns.map((column) => column.name)).toEqual([
            'accommodation_id',
            'platform'
        ]);
        // The partial predicate is what lets a soft-deleted row stop occupying
        // the slot. Without it this is `undefined` and re-adding fails forever.
        expect(uniqueIndex?.config.where).toBeDefined();
    });
});
