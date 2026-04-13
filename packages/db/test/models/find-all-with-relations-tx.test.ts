import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { schema } from '../../src/client';
import * as dbUtils from '../../src/client';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model';
import { DestinationModel } from '../../src/models/destination/destination.model';
import { DbError } from '../../src/utils/error';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('findAllWithRelations - transaction propagation', () => {
    let model: AccommodationModel;
    let getDb: ReturnType<typeof vi.fn>;

    const mockFindMany = vi.fn().mockResolvedValue([{ id: '1', name: 'Test' }]);
    const mockTxDb = {
        query: { accommodations: { findMany: mockFindMany } },
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }])
    } as unknown as NodePgDatabase<typeof schema>;

    const mockGlobalDb = {
        query: { accommodations: { findMany: vi.fn().mockResolvedValue([{ id: 'global' }]) } },
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }])
    };

    beforeEach(() => {
        model = new AccommodationModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // GAP-005: Regression test - no tx uses getDb
    // ========================================================================
    it('uses getDb when no tx is provided (regression)', async () => {
        getDb.mockReturnValue(mockGlobalDb);
        vi.spyOn(model, 'count').mockResolvedValue(1);

        const result = await model.findAllWithRelations({ destination: true });

        expect(getDb).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
    });

    // ========================================================================
    // GAP-005/016: tx bypasses getDb, getClient receives tx
    // ========================================================================
    it('does NOT call getDb when tx is provided', async () => {
        const localFindMany = vi.fn().mockResolvedValue([{ id: '1' }]);
        const localMockTx = {
            query: { accommodations: { findMany: localFindMany } }
        } as unknown as NodePgDatabase<typeof schema>;

        vi.spyOn(model, 'count').mockResolvedValue(5);
        vi.spyOn(model as any, 'getClient').mockReturnValue(localMockTx);

        const result = await model.findAllWithRelations(
            { destination: true },
            {},
            {},
            undefined,
            localMockTx
        );

        expect(getDb).not.toHaveBeenCalled();
        expect(localFindMany).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(5);
    });

    // ========================================================================
    // GAP-005: tx query mock is actually used for findMany
    // ========================================================================
    it('uses the tx-returned client for findMany queries', async () => {
        vi.spyOn(model as any, 'getClient').mockReturnValue(mockTxDb);
        vi.spyOn(model, 'count').mockResolvedValue(1);

        await model.findAllWithRelations({ destination: true }, {}, {}, undefined, mockTxDb);

        expect(mockFindMany).toHaveBeenCalled();
    });

    // ========================================================================
    // GAP-053-035: count() receives tx via options object
    // ========================================================================
    it('forwards tx to count via options object', async () => {
        vi.spyOn(model as any, 'getClient').mockReturnValue(mockTxDb);
        const countSpy = vi.spyOn(model, 'count').mockResolvedValue(3);

        await model.findAllWithRelations({ destination: true }, {}, {}, undefined, mockTxDb);

        expect(countSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ tx: mockTxDb })
        );
    });

    // ========================================================================
    // GAP-053-036: findAll receives tx when no relations requested
    // ========================================================================
    it('forwards tx to findAll when no relations are requested', async () => {
        const findAllSpy = vi.spyOn(model, 'findAll').mockResolvedValue({
            items: [],
            total: 0
        });

        await model.findAllWithRelations({}, {}, {}, undefined, mockTxDb);

        expect(findAllSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            undefined,
            mockTxDb
        );
        expect(getDb).not.toHaveBeenCalled();
    });

    // ========================================================================
    // GAP-007: tx + additionalConditions combination
    // ========================================================================
    it('works with tx + additionalConditions', async () => {
        const localMockTx = {
            query: { accommodations: { findMany: vi.fn().mockResolvedValue([{ id: '1' }]) } }
        } as unknown as NodePgDatabase<typeof schema>;
        vi.spyOn(model, 'count').mockResolvedValue(1);
        vi.spyOn(model as any, 'getClient').mockReturnValue(localMockTx);

        const result = await model.findAllWithRelations(
            { destination: true },
            {},
            {},
            [],
            localMockTx
        );

        expect(getDb).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
    });

    // ========================================================================
    // GAP-045: MAX_PAGE_SIZE cap is respected
    // ========================================================================
    it('caps pageSize at MAX_PAGE_SIZE (200) even when larger value is requested', async () => {
        vi.spyOn(model as any, 'getClient').mockReturnValue(mockTxDb);
        vi.spyOn(model, 'count').mockResolvedValue(0);

        await model.findAllWithRelations(
            { destination: true },
            {},
            { pageSize: 9999 },
            undefined,
            mockTxDb
        );

        expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));
    });

    // ========================================================================
    // GAP-021: tx + sorting parameters
    // ========================================================================
    it('works with tx + pagination options', async () => {
        const localMockTx = {
            query: { accommodations: { findMany: vi.fn().mockResolvedValue([{ id: '1' }]) } }
        } as unknown as NodePgDatabase<typeof schema>;
        vi.spyOn(model, 'count').mockResolvedValue(1);
        vi.spyOn(model as any, 'getClient').mockReturnValue(localMockTx);

        const result = await model.findAllWithRelations(
            { destination: true },
            {},
            { page: 1, pageSize: 10 },
            undefined,
            localMockTx
        );

        expect(getDb).not.toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
    });

    // ========================================================================
    // GAP-006/075: Error path within tx context throws DbError
    // ========================================================================
    it('throws DbError (not generic Error) when query fails within tx', async () => {
        vi.spyOn(model as any, 'getClient').mockReturnValue({
            query: {
                accommodations: {
                    findMany: vi.fn().mockRejectedValue(new Error('connection lost'))
                }
            }
        });
        vi.spyOn(model, 'count').mockRejectedValue(new Error('connection lost'));

        await expect(
            model.findAllWithRelations({ destination: true }, {}, {}, undefined, mockTxDb)
        ).rejects.toThrow(DbError);
    });

    // ========================================================================
    // GAP-035: Dedicated count() with tx test
    // ========================================================================
    describe('count() with tx', () => {
        it('uses getClient(tx) and does NOT call getDb', async () => {
            const mockCountDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 42 }])
                    })
                })
            };
            const getClientSpy = vi.spyOn(model as any, 'getClient').mockReturnValue(mockCountDb);

            const result = await model.count({}, { tx: mockTxDb });

            expect(getClientSpy).toHaveBeenCalledWith(mockTxDb);
            expect(getDb).not.toHaveBeenCalled();
            expect(result).toBe(42);
        });
    });

    // ========================================================================
    // GAP-036: Dedicated findAll() with tx test
    // ========================================================================
    describe('findAll() with tx', () => {
        it('uses getClient(tx) and does NOT call getDb', async () => {
            const mockFindAllDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            $dynamic: vi.fn().mockReturnValue({
                                orderBy: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockReturnValue({
                                        offset: vi.fn().mockResolvedValue([{ id: '1' }])
                                    })
                                }),
                                limit: vi.fn().mockReturnValue({
                                    offset: vi.fn().mockResolvedValue([{ id: '1' }])
                                })
                            })
                        })
                    })
                })
            };
            const getClientSpy = vi.spyOn(model as any, 'getClient').mockReturnValue(mockFindAllDb);
            vi.spyOn(model, 'count').mockResolvedValue(1);

            const result = await model.findAll({}, {}, undefined, mockTxDb);

            expect(getClientSpy).toHaveBeenCalledWith(mockTxDb);
            expect(getDb).not.toHaveBeenCalled();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });
});

// ============================================================================
// T-055 — GAP-053: DestinationModel tx propagation in findAllWithRelations
// ============================================================================
describe('findAllWithRelations - DestinationModel - transaction propagation', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;

    const mockFindMany = vi.fn().mockResolvedValue([{ id: 'd1', name: 'Test Destination' }]);
    const mockTxDb = {
        query: { destinations: { findMany: mockFindMany } },
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }])
    } as unknown as NodePgDatabase<typeof schema>;

    beforeEach(() => {
        model = new DestinationModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses getDb when no tx is provided', async () => {
        // Arrange
        const globalFindMany = vi.fn().mockResolvedValue([{ id: 'global-dest' }]);
        getDb.mockReturnValue({
            query: { destinations: { findMany: globalFindMany } }
        });
        vi.spyOn(model, 'count').mockResolvedValue(1);

        // Act
        const result = await model.findAllWithRelations({ accommodations: true });

        // Assert
        expect(getDb).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
    });

    it('does NOT call getDb when tx is provided', async () => {
        // Arrange
        const localFindMany = vi.fn().mockResolvedValue([{ id: 'd1' }]);
        const localTx = {
            query: { destinations: { findMany: localFindMany } }
        } as unknown as NodePgDatabase<typeof schema>;

        vi.spyOn(model, 'count').mockResolvedValue(1);
        vi.spyOn(model as any, 'getClient').mockReturnValue(localTx);

        // Act
        const result = await model.findAllWithRelations(
            { accommodations: true },
            {},
            {},
            undefined,
            localTx
        );

        // Assert
        expect(getDb).not.toHaveBeenCalled();
        expect(localFindMany).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
    });

    it('uses the tx-returned client for findMany queries', async () => {
        // Arrange
        vi.spyOn(model as any, 'getClient').mockReturnValue(mockTxDb);
        vi.spyOn(model, 'count').mockResolvedValue(1);

        // Act
        await model.findAllWithRelations({ accommodations: true }, {}, {}, undefined, mockTxDb);

        // Assert
        expect(mockFindMany).toHaveBeenCalled();
    });

    it('forwards tx to count via options object', async () => {
        // Arrange
        vi.spyOn(model as any, 'getClient').mockReturnValue(mockTxDb);
        const countSpy = vi.spyOn(model, 'count').mockResolvedValue(5);

        // Act
        await model.findAllWithRelations({ accommodations: true }, {}, {}, undefined, mockTxDb);

        // Assert
        expect(countSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ tx: mockTxDb })
        );
    });

    it('forwards tx to findAll when no relations are requested', async () => {
        // Arrange
        const findAllSpy = vi.spyOn(model, 'findAll').mockResolvedValue({ items: [], total: 0 });

        // Act
        await model.findAllWithRelations({}, {}, {}, undefined, mockTxDb);

        // Assert
        expect(findAllSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            undefined,
            mockTxDb
        );
        expect(getDb).not.toHaveBeenCalled();
    });
});

// ============================================================================
// T-056 — GAP-054: partial-failure tx scenario
// findMany succeeds but count() throws — error must propagate
// ============================================================================
describe('findAllWithRelations - partial-failure tx scenario', () => {
    let model: AccommodationModel;
    let _getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AccommodationModel();
        vi.clearAllMocks();
        _getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('propagates error when count() throws after findMany succeeds', async () => {
        // Arrange: findMany resolves but count rejects
        const successFindMany = vi.fn().mockResolvedValue([{ id: '1', name: 'Test' }]);
        const txWithSuccessQuery = {
            query: { accommodations: { findMany: successFindMany } }
        } as unknown as NodePgDatabase<typeof schema>;

        vi.spyOn(model as any, 'getClient').mockReturnValue(txWithSuccessQuery);
        // count() fails — simulates partial failure
        vi.spyOn(model, 'count').mockRejectedValue(new Error('count failed mid-tx'));

        // Act & Assert
        await expect(
            model.findAllWithRelations({ destination: true }, {}, {}, undefined, txWithSuccessQuery)
        ).rejects.toThrow(DbError);
    });

    it('propagates error when findMany throws (full failure path)', async () => {
        // Arrange
        const failFindMany = vi.fn().mockRejectedValue(new Error('findMany failed'));
        const txWithFailQuery = {
            query: { accommodations: { findMany: failFindMany } }
        } as unknown as NodePgDatabase<typeof schema>;

        vi.spyOn(model as any, 'getClient').mockReturnValue(txWithFailQuery);
        vi.spyOn(model, 'count').mockResolvedValue(5);

        // Act & Assert
        await expect(
            model.findAllWithRelations({ destination: true }, {}, {}, undefined, txWithFailQuery)
        ).rejects.toThrow(DbError);
    });

    it('error from count is wrapped as DbError', async () => {
        // Arrange
        const okFindMany = vi.fn().mockResolvedValue([{ id: '1' }]);
        const tx = {
            query: { accommodations: { findMany: okFindMany } }
        } as unknown as NodePgDatabase<typeof schema>;

        vi.spyOn(model as any, 'getClient').mockReturnValue(tx);
        vi.spyOn(model, 'count').mockRejectedValue(new Error('count db error'));

        // Act & Assert
        await expect(
            model.findAllWithRelations({ destination: true }, {}, {}, undefined, tx)
        ).rejects.toBeInstanceOf(DbError);
    });
});
