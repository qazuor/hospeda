/**
 * @fileoverview
 * Unit tests for `0172-hos-2189-venue-locations` with a mocked `ctx.db`
 * (no real database), the same style as the other data-migration tests.
 */
import { describe, expect, it, vi } from 'vitest';
import * as migration from '../../src/data-migrations/0172-hos-2189-venue-locations.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { deterministicFixtureId } from '../../src/utils/deterministicFixtureId.js';

const ADDRESS = { street: 'Mitre', number: '10', coordinates: { lat: '-32.4', long: '-58.2' } };

describe('planVenueLocationUpdates', () => {
    it('keys each write by the venue seeder deterministic id', () => {
        const plan = migration.planVenueLocationUpdates({
            fixtures: [{ id: '001-venue-x', location: ADDRESS }]
        });
        expect(plan).toEqual([
            {
                venueId: deterministicFixtureId({ seedKey: 'venue:001-venue-x' }),
                location: ADDRESS
            }
        ]);
    });

    it('skips a fixture with no address', () => {
        expect(
            migration.planVenueLocationUpdates({
                fixtures: [{ id: 'a' }, { id: 'b', location: null }]
            })
        ).toEqual([]);
    });
});

describe('0172 up()', () => {
    it('writes one guarded UPDATE per real fixture and reports the rows it changed', async () => {
        const execute = vi.fn(async () => ({ rows: [{ id: 'x' }] }));
        const ctx = { db: { execute } } as unknown as SeedMigrationCtx;

        const result = await migration.up(ctx);

        expect(execute).toHaveBeenCalledTimes(6);
        expect(result.counts).toEqual({ planned: 6, updated: 6 });
    });

    it('is a no-op once the rows have an address (nothing returned)', async () => {
        const execute = vi.fn(async () => ({ rows: [] }));
        const ctx = { db: { execute } } as unknown as SeedMigrationCtx;

        const result = await migration.up(ctx);

        expect(result.counts).toEqual({ planned: 6, updated: 0 });
    });

    it('declares itself non destructive', () => {
        expect(migration.meta.destructive).toBe(false);
    });
});
