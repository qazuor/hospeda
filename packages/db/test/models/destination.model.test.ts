import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { DestinationModel } from '../../src/models/destination/destination.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

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
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        model.findOne = mockFindOne;
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
        expect(mockFindOne).toHaveBeenCalledWith(where, undefined);
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

// ============================================================================
// T-047: tx propagation for DestinationModel custom methods
// ============================================================================
describe('DestinationModel - tx propagation', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findWithRelations() uses tx when provided (with relations branch)', async () => {
        // Arrange
        const findFirst = vi.fn().mockResolvedValue({ id: '1', accommodations: [] });
        const mockTx = { query: { destinations: { findFirst } } } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.findWithRelations({ id: '1' }, { accommodations: true }, mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('findAllByAttractionId() uses tx when provided', async () => {
        // Arrange
        const whereMock = vi.fn().mockResolvedValue([{ destination: { id: 'd1' } }]);
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    innerJoin: vi.fn().mockReturnValue({ where: whereMock })
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.findAllByAttractionId('a1', mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('searchWithAttractions() uses tx when provided', async () => {
        // Arrange
        const mockItems = [{ id: 'd1', name: 'Dest' }];
        const orderByMock = vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockItems)
            })
        });
        const _attractionWhereMock = vi.fn().mockResolvedValue([]);
        const attractionOrderByMock = vi.fn().mockResolvedValue([]);
        const mockTx = {
            select: vi
                .fn()
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: orderByMock
                        })
                    })
                })
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        innerJoin: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                orderBy: attractionOrderByMock
                            })
                        })
                    })
                })
                .mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 1 }])
                    })
                })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.searchWithAttractions({}, mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('search() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi
                .fn()
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockReturnValue({
                                    offset: vi.fn().mockResolvedValue([{ id: 'd1' }])
                                })
                            })
                        })
                    })
                })
                .mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 1 }])
                    })
                })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.search({}, mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('countByFilters() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 3 }])
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        const result = await model.countByFilters({}, mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();
        expect(result.count).toBe(3);

        spy.mockRestore();
    });

    it('findChildren() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockResolvedValue([{ id: 'd2' }])
                    })
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.findChildren('parent-1', mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('findByPath() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: 'd1', path: '/ar/er' }])
                    })
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.findByPath('/ar/er', mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });

    it('getAttractionsMap() uses tx when provided', async () => {
        // Arrange
        const mockTx = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    innerJoin: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            })
        } as any;
        const spy = vi.spyOn(model as any, 'getClient');
        spy.mockReturnValue(mockTx);

        // Act
        await model.getAttractionsMap(['d1'], mockTx);

        // Assert
        expect(spy).toHaveBeenCalledWith(mockTx);
        expect(getDb).not.toHaveBeenCalled();

        spy.mockRestore();
    });
});

/**
 * Unit tests for DestinationModel.findAllByAttractionId
 * - Ensures correct join on r_destination_attraction filtering by attractionId (not destinations.id)
 * - Handles empty results and DB errors
 */
describe('DestinationModel.findAllByAttractionId', () => {
    let model: DestinationModel;
    let getDbMock: ReturnType<typeof vi.fn>;
    let logQueryMock: ReturnType<typeof vi.fn>;
    let logErrorMock: ReturnType<typeof vi.fn>;

    const sampleRows = [
        { destination: { id: 'dest-1', name: 'Destination 1' } },
        { destination: { id: 'dest-2', name: 'Destination 2' } }
    ];

    /** Builds a chainable mock for db.select().from().innerJoin().where() */
    function buildSelectChain(finalResolved: unknown[], shouldReject = false) {
        const whereMock = vi
            .fn()
            .mockImplementation(() =>
                shouldReject
                    ? Promise.reject(new Error('DB failure'))
                    : Promise.resolve(finalResolved)
            );
        const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
        const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
        const selectMock = vi.fn().mockReturnValue({ from: fromMock });
        return { selectMock, fromMock, innerJoinMock, whereMock };
    }

    beforeEach(() => {
        model = new DestinationModel();
        vi.clearAllMocks();
        getDbMock = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        logQueryMock = logger.logQuery as ReturnType<typeof vi.fn>;
        logErrorMock = logger.logError as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns destinations linked to the given attractionId via join table (not by own id)', async () => {
        // Arrange
        const { selectMock, innerJoinMock, whereMock } = buildSelectChain(sampleRows);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        const result = await model.findAllByAttractionId('a1');

        // Assert – result is mapped from row.destination
        expect(result).toEqual([
            { id: 'dest-1', name: 'Destination 1' },
            { id: 'dest-2', name: 'Destination 2' }
        ]);
        // Verify the join was made (innerJoin called) and where was called with attractionId filter
        expect(innerJoinMock).toHaveBeenCalled();
        expect(whereMock).toHaveBeenCalled();
        expect(logQueryMock).toHaveBeenCalledWith(
            'destinations',
            'findAllByAttractionId',
            { attractionId: 'a1' },
            expect.any(Array)
        );
    });

    it('returns empty array when no destinations are linked to the given attractionId', async () => {
        // Arrange
        const { selectMock } = buildSelectChain([]);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act
        const result = await model.findAllByAttractionId('no-match');

        // Assert
        expect(result).toEqual([]);
        expect(logQueryMock).toHaveBeenCalledWith(
            'destinations',
            'findAllByAttractionId',
            { attractionId: 'no-match' },
            []
        );
    });

    it('throws DbError and logs when the database query fails', async () => {
        // Arrange
        const { selectMock } = buildSelectChain([], true);
        getDbMock.mockReturnValue({ select: selectMock });

        // Act & Assert
        await expect(model.findAllByAttractionId('a3')).rejects.toThrow('DB failure');
        expect(logErrorMock).toHaveBeenCalledWith(
            'destinations',
            'findAllByAttractionId',
            { attractionId: 'a3' },
            expect.any(Error)
        );
    });
});
