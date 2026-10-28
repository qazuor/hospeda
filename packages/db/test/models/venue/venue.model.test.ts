/**
 * Unit tests for `VenueModel.findIdsByOwnerId` (HOS-734).
 *
 * Mirrors `AccommodationModel.findIdsByOwnerId`: resolves the IDs of every
 * non-deleted venue listing owned by a given user, used by
 * `EntityViewService.getStatsForOwnListings` /
 * `getDailySeriesForOwnListings` to scope the owner's view stats
 * without accepting a caller-supplied ownerId (anti-peeking).
 *
 * Uses a mocked Drizzle client (`vi.spyOn(dbUtils, 'getDb')`) per the project
 * convention — no real DB connection required.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { VenueModel } from '../../../src/models/venue/venue.model';
import * as logger from '../../../src/utils/logger';

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('VenueModel.findIdsByOwnerId', () => {
    let model: VenueModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new VenueModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the owned listing IDs and logs the query', async () => {
        const rows = [{ id: 'venue-1' }, { id: 'venue-2' }];
        const where = vi.fn().mockResolvedValue(rows);
        const from = vi.fn().mockReturnValue({ where });
        const select = vi.fn().mockReturnValue({ from });
        getDb.mockReturnValue({ select });

        const result = await model.findIdsByOwnerId('owner-1');

        expect(result).toEqual(['venue-1', 'venue-2']);
        expect(select).toHaveBeenCalledWith({ id: expect.anything() });
        expect(logQuery).toHaveBeenCalledWith(
            'venues',
            'findIdsByOwnerId',
            { ownerId: 'owner-1' },
            { count: 2 }
        );
    });

    it('returns an empty array when the owner has no listings', async () => {
        const where = vi.fn().mockResolvedValue([]);
        const from = vi.fn().mockReturnValue({ where });
        const select = vi.fn().mockReturnValue({ from });
        getDb.mockReturnValue({ select });

        const result = await model.findIdsByOwnerId('owner-with-none');

        expect(result).toEqual([]);
    });

    it('logs and rethrows as DbError when the query fails', async () => {
        const where = vi.fn().mockRejectedValue(new Error('connection reset'));
        const from = vi.fn().mockReturnValue({ where });
        const select = vi.fn().mockReturnValue({ from });
        getDb.mockReturnValue({ select });

        await expect(model.findIdsByOwnerId('owner-1')).rejects.toMatchObject({
            name: 'DbError',
            method: 'findIdsByOwnerId',
            message: 'connection reset'
        });
        expect(logError).toHaveBeenCalled();
    });

    it('uses the provided transaction client instead of getDb()', async () => {
        const where = vi.fn().mockResolvedValue([{ id: 'venue-tx' }]);
        const from = vi.fn().mockReturnValue({ where });
        const select = vi.fn().mockReturnValue({ from });
        const mockTx = { select } as unknown as Parameters<typeof model.findIdsByOwnerId>[1];

        const result = await model.findIdsByOwnerId('owner-1', mockTx);

        expect(result).toEqual(['venue-tx']);
        expect(getDb).not.toHaveBeenCalled();
    });
});
