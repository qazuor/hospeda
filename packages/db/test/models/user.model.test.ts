import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { UserModel } from '../../src/models/user/user.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('UserModel', () => {
    let model: UserModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new UserModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // T-053 (1): findAll() basic
    // ========================================================================
    describe('findAll', () => {
        it('should return items and total when paginated', async () => {
            // Arrange
            const mockItems = [{ id: 'u1', displayName: 'Alice' }];
            const db = {
                select: vi.fn((_args?: unknown) => ({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                offset: vi.fn().mockResolvedValue(mockItems)
                            }),
                            $dynamic: vi.fn()
                        })
                    })
                }))
            };
            // count call
            const countDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 1 }])
                    })
                })
            };
            // For paginated: two parallel queries via Promise.all
            // We need getDb to return a db that handles both select chains
            const selectCallCount = { n: 0 };
            getDb.mockImplementation(() => {
                selectCallCount.n++;
                if (selectCallCount.n === 1) return db;
                return countDb;
            });
            getDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi
                            .fn()
                            .mockReturnValueOnce({
                                limit: vi.fn().mockReturnValue({
                                    offset: vi.fn().mockResolvedValue(mockItems)
                                })
                            })
                            .mockResolvedValue([{ count: 1 }])
                    })
                })
            });

            // Act
            const result = await model.findAll({}, { page: 1, pageSize: 10 });

            // Assert
            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('total');
            expect(getDb).toHaveBeenCalled();
        });

        it('should apply safety limit when unpaginated', async () => {
            // Arrange
            getDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([{ id: 'u1' }])
                        })
                    })
                })
            });

            // Act
            const result = await model.findAll({});

            // Assert
            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('total');
        });
    });

    // ========================================================================
    // T-053 (2): count() returns number
    // ========================================================================
    describe('count', () => {
        it('should return a number without q filter', async () => {
            // Arrange
            getDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 7 }])
                    })
                })
            });

            // Act
            const result = await model.count({});

            // Assert
            expect(typeof result).toBe('number');
            expect(result).toBe(7);
        });

        it('should return a number with q filter (text search path)', async () => {
            // Arrange
            getDb.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 3 }])
                    })
                })
            });

            // Act
            const result = await model.count({ q: 'alice' });

            // Assert
            expect(result).toBe(3);
        });
    });

    // ========================================================================
    // T-053 (3): findAllWithCounts() smoke test
    // ========================================================================
    describe('findAllWithCounts', () => {
        it('should return items with counts and total', async () => {
            // Arrange
            const mockRows = [
                {
                    user: { id: 'u1', displayName: 'Alice' },
                    accommodationsCount: 2,
                    eventsCount: 1,
                    postsCount: 3
                }
            ];
            // findAllWithCounts paginated path: baseQuery.$dynamic().limit(n).offset(n) -> rows
            // then: db.select({ count }).from(users).where(clause) -> [{ count: 1 }]
            const paginatedChain = {
                limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockRows)
                })
            };
            const mockSelectResult = {
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        $dynamic: vi.fn().mockReturnValue(paginatedChain)
                    })
                })
            };
            const countSelectResult = {
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ count: 1 }])
                })
            };

            getDb.mockReturnValue({
                select: vi
                    .fn()
                    .mockReturnValueOnce(mockSelectResult)
                    .mockReturnValueOnce(countSelectResult)
            });

            // Act
            const result = await model.findAllWithCounts({}, { page: 1, pageSize: 10 });

            // Assert
            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('total');
        });

        it('should return items without pagination (safety limit path)', async () => {
            // Arrange
            const mockRows = [
                {
                    user: { id: 'u1', displayName: 'Alice' },
                    accommodationsCount: 0,
                    eventsCount: 0,
                    postsCount: 0
                }
            ];
            const mockSelectResult = {
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        $dynamic: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue(mockRows)
                        })
                    })
                })
            };

            getDb.mockReturnValue({
                select: vi.fn().mockReturnValue(mockSelectResult)
            });

            // Act
            const result = await model.findAllWithCounts({});

            // Assert
            expect(result).toHaveProperty('items');
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    // ========================================================================
    // T-053 (4): tx propagation for each custom method via getClient spy
    // ========================================================================
    describe('tx propagation', () => {
        it('findAll() uses tx when provided', async () => {
            // Arrange
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([{ id: 'u1' }])
                        })
                    })
                })
            };
            const spy = vi.spyOn(
                model as unknown as { getClient: (tx?: unknown) => unknown },
                'getClient'
            );
            spy.mockReturnValue(mockTx);

            // Act
            await model.findAll({}, undefined, undefined, mockTx as never);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });

        it('count() uses tx when provided (with q)', async () => {
            // Arrange
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ count: 4 }])
                    })
                })
            };
            const spy = vi.spyOn(
                model as unknown as { getClient: (tx?: unknown) => unknown },
                'getClient'
            );
            spy.mockReturnValue(mockTx);

            // Act
            const result = await model.count({ q: 'bob' }, { tx: mockTx as never });

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();
            expect(result).toBe(4);

            spy.mockRestore();
        });

        it('findAllWithCounts() uses tx when provided', async () => {
            // Arrange
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            $dynamic: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                })
            };
            const spy = vi.spyOn(
                model as unknown as { getClient: (tx?: unknown) => unknown },
                'getClient'
            );
            spy.mockReturnValue(mockTx);

            // Act
            await model.findAllWithCounts({}, undefined, undefined, mockTx as never);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });
    });
});
