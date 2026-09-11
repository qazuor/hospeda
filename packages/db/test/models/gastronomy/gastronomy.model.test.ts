/**
 * Unit tests for `GastronomyModel.findIdsByOwnerId` (HOS-734).
 *
 * Mirrors `AccommodationModel.findIdsByOwnerId`: resolves the IDs of every
 * non-deleted gastronomy listing owned by a given user, used by
 * `EntityViewService.getStatsForOwnCommerceListings` /
 * `getDailySeriesForOwnCommerceListings` to scope the owner's view stats
 * without accepting a caller-supplied ownerId (anti-peeking).
 *
 * Uses a mocked Drizzle client (`vi.spyOn(dbUtils, 'getDb')`) per the project
 * convention — no real DB connection required.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { GastronomyModel } from '../../../src/models/gastronomy/gastronomy.model';
import * as logger from '../../../src/utils/logger';

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('GastronomyModel.findIdsByOwnerId', () => {
    let model: GastronomyModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new GastronomyModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the owned listing IDs and logs the query', async () => {
        const rows = [{ id: 'gastro-1' }, { id: 'gastro-2' }];
        const where = vi.fn().mockResolvedValue(rows);
        const from = vi.fn().mockReturnValue({ where });
        const select = vi.fn().mockReturnValue({ from });
        getDb.mockReturnValue({ select });

        const result = await model.findIdsByOwnerId('owner-1');

        expect(result).toEqual(['gastro-1', 'gastro-2']);
        expect(select).toHaveBeenCalledWith({ id: expect.anything() });
        expect(logQuery).toHaveBeenCalledWith(
            'gastronomies',
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
        const where = vi.fn().mockResolvedValue([{ id: 'gastro-tx' }]);
        const from = vi.fn().mockReturnValue({ where });
        const select = vi.fn().mockReturnValue({ from });
        const mockTx = { select } as unknown as Parameters<typeof model.findIdsByOwnerId>[1];

        const result = await model.findIdsByOwnerId('owner-1', mockTx);

        expect(result).toEqual(['gastro-tx']);
        expect(getDb).not.toHaveBeenCalled();
    });
});
