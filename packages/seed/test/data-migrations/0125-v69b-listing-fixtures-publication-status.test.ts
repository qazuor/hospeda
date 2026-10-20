import { describe, expect, it } from 'vitest';
import {
    meta,
    up
} from '../../src/data-migrations/0125-v69b-listing-fixtures-publication-status.js';

describe('HOS-1641 listing fixture dual-write', () => {
    it('reports zero rewritten listings without touching the database', async () => {
        // Arrange: an empty context proves `up` reads nothing from it.
        const ctx = {} as Parameters<typeof up>[0];

        // Act
        const result = await up(ctx);

        // Assert
        expect(meta).toMatchObject({
            name: '0125-v69b-listing-fixtures-publication-status',
            group: 'required',
            destructive: false
        });
        expect(result.counts).toEqual({ listingsRewritten: 0 });
        expect(result.summary).toContain('No listing rows');
    });
});
