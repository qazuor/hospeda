import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { DestinationModel } from '../../src/models/destination/destination.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('DestinationModel', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        model.findOne = mockFindOne;
    });

    it('findWithRelations returns result with relations and logs', async () => {
        const db = {
            query: {
                destinations: {
                    findFirst: vi
                        .fn()
                        .mockResolvedValue({ id: '1', accommodations: [{ id: 'a1' }] })
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '1' };
        const relations = { accommodations: true };
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '1', accommodations: [{ id: 'a1' }] });
        expect(db.query.destinations.findFirst).toHaveBeenCalled();
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findWithRelations',
            { where, relations },
            { id: '1', accommodations: [{ id: 'a1' }] }
        );
    });

    it('findWithRelations falls back to findOne and logs', async () => {
        getDb.mockReturnValue({});
        const where = { id: '2' };
        const relations = { accommodations: false };
        mockFindOne.mockResolvedValue({ id: '2' });
        const result = await model.findWithRelations(where, relations);
        expect(result).toEqual({ id: '2' });
        expect(mockFindOne).toHaveBeenCalledWith(where);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findWithRelations',
            { where, relations },
            { id: '2' }
        );
    });

    it('findWithRelations logs and throws on error', async () => {
        const db = {
            query: {
                destinations: {
                    findFirst: vi.fn().mockRejectedValue(new Error('fail'))
                }
            }
        };
        getDb.mockReturnValue(db);
        const where = { id: '3' };
        const relations = { accommodations: true };
        await expect(model.findWithRelations(where, relations)).rejects.toThrow('fail');
        expect(logError).toHaveBeenCalledWith(
            'destinations',
            'findWithRelations',
            { where, relations },
            expect.any(Error)
        );
    });
});

/**
 * Unit tests for DestinationModel.findAllByAttractionId
 * - Ensures correct join and filtering by attractionId
 * - Handles empty results and DB errors
 */
describe('DestinationModel.findAllByAttractionId', () => {
    let model: DestinationModel;
    let getDbMock: ReturnType<typeof vi.fn>;
    let logQueryMock: ReturnType<typeof vi.fn>;
    let logErrorMock: ReturnType<typeof vi.fn>;
    const mockDb = {
        query: {
            destinations: {
                findMany: vi.fn()
            }
        }
    };
    const sampleDestinations = [
        { id: 'dest-1', name: 'Destination 1', attractions: [{ attractionId: 'a1' }] },
        { id: 'dest-2', name: 'Destination 2', attractions: [{ attractionId: 'a1' }] }
    ];

    beforeEach(() => {
        model = new DestinationModel();
        getDbMock = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQueryMock = logger.logQuery as ReturnType<typeof vi.fn>;
        logErrorMock = logger.logError as ReturnType<typeof vi.fn>;
        getDbMock.mockReturnValue(mockDb);
        mockDb.query.destinations.findMany.mockReset();
        logQueryMock.mockReset();
        logErrorMock.mockReset();
    });

    it('returns destinations related to the given attractionId', async () => {
        mockDb.query.destinations.findMany.mockResolvedValueOnce(sampleDestinations);
        const result = await model.findAllByAttractionId('a1');
        expect(result).toEqual(sampleDestinations);
        expect(mockDb.query.destinations.findMany).toHaveBeenCalledWith({
            where: expect.any(Function),
            with: { attractions: true }
        });
        expect(logQueryMock).toHaveBeenCalled();
    });

    it('returns empty array if no destinations found', async () => {
        mockDb.query.destinations.findMany.mockResolvedValueOnce([]);
        const result = await model.findAllByAttractionId('a2');
        expect(result).toEqual([]);
        expect(logQueryMock).toHaveBeenCalled();
    });

    it('throws and logs error if DB fails', async () => {
        const error = new Error('DB failure');
        mockDb.query.destinations.findMany.mockRejectedValueOnce(error);
        await expect(model.findAllByAttractionId('a3')).rejects.toThrow('DB failure');
        expect(logErrorMock).toHaveBeenCalled();
    });
});
