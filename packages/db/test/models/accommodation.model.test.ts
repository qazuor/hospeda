import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AccommodationModel } from '../../src/models/accommodation.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('AccommodationModel', () => {
    let model: AccommodationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AccommodationModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        // Mock findOne fallback
        model.findOne = mockFindOne;
    });

    it('findWithRelations returns result with relations and logs', async () => {
        const db = {
            query: {
                accommodations: {
                    findFirst: vi.fn().mockResolvedValue({ id: '1', destination: { id: 'd1' } })
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '1' };
        const relations = { destination: true };
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '1', destination: { id: 'd1' } });
        expect(db.query.accommodations.findFirst).toHaveBeenCalled();
        expect(logQuery).toHaveBeenCalledWith(
            'accommodations',
            'findWithRelations',
            { where, relations },
            { id: '1', destination: { id: 'd1' } }
        );
    });

    it('findWithRelations falls back to findOne and logs', async () => {
        getDb.mockReturnValue({});
        const where = { id: '2' };
        const relations = { destination: false };
        mockFindOne.mockResolvedValue({ id: '2' });
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '2' });
        expect(mockFindOne).toHaveBeenCalledWith(where);
        expect(logQuery).toHaveBeenCalledWith(
            'accommodations',
            'findWithRelations',
            { where, relations },
            { id: '2' }
        );
    });

    it('findWithRelations logs and throws on error', async () => {
        const db = {
            query: {
                accommodations: {
                    findFirst: vi.fn().mockRejectedValue(new Error('fail'))
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '3' };
        const relations = { destination: true };
        await expect(model.findWithRelations(where, relations)).rejects.toThrow('fail');
        expect(logError).toHaveBeenCalledWith(
            'accommodations',
            'findWithRelations',
            { where, relations },
            expect.any(Error)
        );
    });
});
