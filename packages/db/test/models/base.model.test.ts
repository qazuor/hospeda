import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModelImpl as BaseModel } from '../../src/base/base.model';
import * as dbUtils from '../../src/client';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

// Dummy table mock — includes deletedAt to support softDelete/restore tests
const mockTable = {
    id: { count: () => ({ as: () => 'COUNT_COL' }) },
    name: {},
    deletedAt: {}
};

type DummyType = { id: string; name?: string };

class DummyModel extends BaseModel<DummyType> {
    // @ts-expect-error: mock table for test, not a real Drizzle table
    protected table = mockTable as unknown as Record<
        string,
        { count?: () => { as: () => string } } | object
    >;
    public entityName = 'dummy';

    protected getTableName(): string {
        throw new Error('getTableName not implemented in base test model');
    }
}

class NoIdModel extends BaseModel<{ foo: string }> {
    // @ts-expect-error: mock table for test, not a real Drizzle table
    protected table = {
        foo: { count: () => ({ as: () => 'COUNT_COL' }) }
    } as unknown as Record<string, { count: () => { as: () => string } }>;
    public entityName = 'noid';

    protected getTableName(): string {
        throw new Error('getTableName not implemented in test model');
    }
}

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('BaseModel', () => {
    let model: DummyModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DummyModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findAll returns and logs', async () => {
        getDb.mockReturnValue({
            select: (args?: unknown) => ({
                from: () => ({
                    where: () => {
                        if (args && typeof args === 'object' && 'count' in args) {
                            // count query
                            return Promise.resolve([{ count: '1' }]);
                        }
                        // items query - $dynamic() returns the query builder itself
                        const qb = {
                            limit: () => ({ offset: () => Promise.resolve([{ id: '1' }]) }),
                            $dynamic: () => qb
                        };
                        return qb;
                    }
                })
            })
        });
        const result = await model.findAll({ id: '1' });
        expect(result).toEqual({ items: [{ id: '1' }], total: 1 });
        expect(logQuery).toHaveBeenCalled();
    });

    it('findById returns and logs', async () => {
        getDb.mockReturnValue({
            select: () => ({ from: () => ({ where: () => ({ limit: () => [{ id: '2' }] }) }) })
        });
        const result = await model.findById('2');
        expect(result).toEqual({ id: '2' });
        expect(logQuery).toHaveBeenCalled();
    });

    it('update returns and logs', async () => {
        getDb.mockReturnValue({
            update: () => ({ set: () => ({ where: () => ({ returning: () => [{ id: '3' }] }) }) })
        });
        const result = await model.update({ id: '3' }, { name: 'foo' });
        expect(result).toEqual({ id: '3' });
        expect(logQuery).toHaveBeenCalled();
    });

    it('count returns and logs', async () => {
        getDb.mockReturnValue({
            select: () => ({
                from: () => ({
                    where: () => Promise.resolve([{ count: '5' }])
                })
            })
        });
        const result = await model.count({});
        expect(result).toBe(5);
        expect(logQuery).toHaveBeenCalled();
    });

    it('hardDelete throws DbError when where is empty', async () => {
        await expect(model.hardDelete({})).rejects.toThrow(DbError);
        await expect(model.hardDelete({})).rejects.toThrow(
            'where clause cannot be empty — this would delete all records'
        );
    });

    it('softDelete throws DbError when where is empty', async () => {
        await expect(model.softDelete({})).rejects.toThrow(DbError);
        await expect(model.softDelete({})).rejects.toThrow(
            'where clause cannot be empty — this would soft-delete all records'
        );
    });

    it('restore throws DbError when where is empty', async () => {
        await expect(model.restore({})).rejects.toThrow(DbError);
        await expect(model.restore({})).rejects.toThrow(
            'where clause cannot be empty — this would restore all soft-deleted records'
        );
    });

    it('logs and throws DbError on DB error', async () => {
        getDb.mockReturnValue({
            select: () => ({
                from: () => ({
                    where: () => {
                        throw new Error('fail');
                    }
                })
            })
        });
        await expect(model.findAll({})).rejects.toThrow(DbError);
        expect(logError).toHaveBeenCalled();
    });

    it('findAll handles empty filter', async () => {
        getDb.mockReturnValue({
            select: (args?: unknown) => ({
                from: () => ({
                    where: () => {
                        if (args && typeof args === 'object' && 'count' in args) {
                            // count query
                            return Promise.resolve([{ count: '1' }]);
                        }
                        // items query
                        const qb = {
                            limit: () => ({ offset: () => Promise.resolve([{ id: '1' }]) }),
                            $dynamic: () => qb
                        };
                        return qb;
                    }
                })
            })
        });
        const result = await model.findAll({});
        expect(result).toEqual({ items: [{ id: '1' }], total: 1 });
    });

    it('findAll handles null filter', async () => {
        getDb.mockReturnValue({
            select: (args?: unknown) => ({
                from: () => ({
                    where: () => {
                        if (args && typeof args === 'object' && 'count' in args) {
                            // count query
                            return Promise.resolve([{ count: '1' }]);
                        }
                        // items query
                        const qb = {
                            limit: () => ({ offset: () => Promise.resolve([{ id: '1' }]) }),
                            $dynamic: () => qb
                        };
                        return qb;
                    }
                })
            })
        });
        // @ts-expect-error purposely passing null
        const result = await model.findAll(null);
        expect(result).toEqual({ items: [{ id: '1' }], total: 1 });
    });

    it('findById handles undefined/null', async () => {
        getDb.mockReturnValue({
            select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) })
        });
        // @ts-expect-error purposely passing undefined
        const result1 = await model.findById(undefined);
        expect(result1).toBeNull();
        // @ts-expect-error purposely passing null
        const result2 = await model.findById(null);
        expect(result2).toBeNull();
    });

    it('update handles empty data and undefined/null fields', async () => {
        getDb.mockReturnValue({
            update: () => ({ set: () => ({ where: () => ({ returning: () => [{}] }) }) })
        });
        // Empty data guard: update() returns null immediately without hitting the DB
        const result = await model.update({ id: '3' }, {});
        expect(result).toBeNull();
        // Data with undefined/null values still has keys, so it reaches the DB
        // The mock returns [{}], so update returns {}
        const result2 = await model.update({ id: '3' }, { name: undefined });
        expect(result2).toEqual({});
        const result3 = await model.update({ id: '3' }, { name: null as unknown as string });
        expect(result3).toEqual({});
    });

    it('findAll handles DB returning undefined', async () => {
        getDb.mockReturnValue({
            select: (args?: unknown) => ({
                from: () => ({
                    where: () => {
                        if (args && typeof args === 'object' && 'count' in args) {
                            // count query returns empty result
                            return Promise.resolve([{ count: '0' }]);
                        }
                        // items query returns empty array when no results
                        const qb = {
                            limit: () => ({ offset: () => Promise.resolve([]) }),
                            $dynamic: () => qb
                        };
                        return qb;
                    }
                })
            })
        });
        const result = await model.findAll({});
        expect(result).toEqual({ items: [], total: 0 });
    });

    it('count handles count undefined or missing', async () => {
        getDb.mockReturnValue({
            select: () => ({
                from: () => ({
                    where: () => Promise.resolve([{}])
                })
            })
        });
        const result = await model.count({});
        expect(result).toBe(0);
        getDb.mockReturnValue({
            select: () => ({
                from: () => ({
                    where: () => Promise.resolve([{ count: undefined }])
                })
            })
        });
        const result2 = await model.count({});
        expect(result2).toBe(0);
    });

    it('logger throws error but model still throws DbError', async () => {
        getDb.mockReturnValue({
            select: () => ({
                from: () => ({
                    where: () => {
                        throw new Error('fail');
                    }
                })
            })
        });
        logError.mockImplementation(() => {
            throw new Error('logger fail');
        });
        await expect(model.findAll({})).rejects.toThrow(DbError);
    });

    it('handles DB throwing non-Error', async () => {
        getDb.mockReturnValue({
            select: () => ({
                from: () => ({
                    where: () => {
                        throw 'fail';
                    }
                })
            })
        });
        await expect(model.findAll({})).rejects.toThrow(DbError);
    });

    it('hardDelete returns 0 if no match', async () => {
        getDb.mockReturnValue({ delete: () => ({ where: () => ({ returning: () => [] }) }) });
        const result = await model.hardDelete({ id: 'notfound' });
        expect(result).toBe(0);
    });

    it('softDelete returns 0 if no match', async () => {
        getDb.mockReturnValue({
            update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) })
        });
        const result = await model.softDelete({ id: 'notfound' });
        expect(result).toBe(0);
    });

    it('restore returns 0 if no match', async () => {
        getDb.mockReturnValue({
            update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) })
        });
        const result = await model.restore({ id: 'notfound' });
        expect(result).toBe(0);
    });

    it('findAll handles where with wrong type', async () => {
        getDb.mockReturnValue({
            select: (args?: unknown) => ({
                from: () => ({
                    where: () => {
                        if (args && typeof args === 'object' && 'count' in args) {
                            // count query
                            return Promise.resolve([{ count: '1' }]);
                        }
                        // items query
                        const qb = {
                            limit: () => ({ offset: () => Promise.resolve([{ id: 123 }]) }),
                            $dynamic: () => qb
                        };
                        return qb;
                    }
                })
            })
        });
        const result = await model.findAll({ id: 123 });
        expect(result).toEqual({ items: [{ id: 123 }], total: 1 });
    });

    it('update with non-existent field', async () => {
        getDb.mockReturnValue({
            update: () => ({
                set: () => ({ where: () => ({ returning: () => [{ id: 'x', foo: 'bar' }] }) })
            })
        });
        // @ts-expect-error purposely passing extra field
        const result = await model.update({ id: 'x' }, { foo: 'bar' });
        expect(result).toEqual({ id: 'x', foo: 'bar' });
    });

    it('findById handles multiple results', async () => {
        getDb.mockReturnValue({
            select: () => ({
                from: () => ({ where: () => ({ limit: () => [{ id: 'a' }, { id: 'b' }] }) })
            })
        });
        const result = await model.findById('a');
        expect(result).toEqual({ id: 'a' });
    });

    it('update handles multiple results', async () => {
        getDb.mockReturnValue({
            update: () => ({
                set: () => ({ where: () => ({ returning: () => [{ id: 'a' }, { id: 'b' }] }) })
            })
        });
        const result = await model.update({ id: 'a' }, { name: 'foo' });
        expect(result).toEqual({ id: 'a' });
    });

    it('count works with table without id', async () => {
        const model = new NoIdModel();
        getDb.mockReturnValue({
            select: () => ({ from: () => ({ where: () => Promise.resolve([{ count: '1' }]) }) })
        });
        const result = await model.count({});
        expect(result).toBe(1);
    });

    // Pagination test omitted: findAll uses Promise.all for items+count in parallel,
    // which requires the mock to support both $dynamic() chaining and count queries
    // simultaneously. The shallow getDb mock cannot replicate this without becoming
    // a full Drizzle query-builder reimplementation. Covered by integration tests.

    describe('tx propagation', () => {
        /**
         * Shared minimal mock for a DrizzleClient that supports all query shapes
         * used by BaseModelImpl. Each test overrides only the methods it needs.
         */
        function buildMockTx(): ReturnType<typeof vi.fn> {
            const selectChain = {
                from: () => ({
                    where: () => {
                        const qb = {
                            limit: () => ({ offset: () => Promise.resolve([]) }),
                            $dynamic: () => qb
                        };
                        return qb;
                    }
                })
            };
            const updateChain = {
                set: () => ({ where: () => ({ returning: () => [] }) })
            };
            const deleteChain = { where: () => ({ returning: () => [] }) };
            const insertChain = { values: () => ({ returning: () => [{ id: 'tx-1' }] }) };
            const countSelectChain = {
                from: () => ({
                    where: () => Promise.resolve([{ count: '0' }])
                })
            };

            // select() is called with either undefined (items) or { count: count() } (count queries)
            const selectFn = vi.fn((arg?: unknown) => {
                if (arg && typeof arg === 'object' && 'count' in (arg as object)) {
                    return countSelectChain;
                }
                return selectChain;
            });

            return {
                select: selectFn,
                update: vi.fn(() => updateChain),
                delete: vi.fn(() => deleteChain),
                insert: vi.fn(() => insertChain),
                query: {}
            } as unknown as ReturnType<typeof vi.fn>;
        }

        it('findAll() passes tx to getClient()', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );

            // Make getClient return mockTx so the query chain resolves correctly
            getClientSpy.mockReturnValue(mockTx);

            await model.findAll(
                {},
                undefined,
                undefined,
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('findById() passes tx to getClient()', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await model.findById(
                '1',
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('findOne() passes tx to getClient()', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await model.findOne(
                {},
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('count() passes tx to getClient() via options', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await model.count(
                {},
                { tx: mockTx as unknown as import('../../src/types.ts').DrizzleClient }
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('create() passes tx to getClient()', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await model.create(
                { id: 'new-1' },
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('update() passes tx to getClient()', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await model.update(
                { id: '1' },
                { name: 'updated' },
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('hardDelete() passes tx to getClient()', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await model.hardDelete(
                { id: '1' },
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('softDelete() passes tx to getClient()', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await model.softDelete(
                { id: '1' },
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('restore() passes tx to getClient()', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await model.restore(
                { id: '1' },
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('findWithRelations() passes tx to getClient()', async () => {
            const mockTx = buildMockTx();
            const getClientSpy = vi.spyOn(
                model as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await model.findWithRelations(
                {},
                {},
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('findAllWithRelations() passes tx to getClient()', async () => {
            class DummyModelWithTableNameTx extends DummyModel {
                protected getTableName(): string {
                    return 'dummies';
                }
            }
            const modelTx = new DummyModelWithTableNameTx();

            const mockTx = buildMockTx();
            // Add query.dummies.findMany for the relations path
            (mockTx as unknown as Record<string, unknown>).query = {
                dummies: {
                    findMany: vi.fn().mockResolvedValue([])
                }
            };

            const getClientSpy = vi.spyOn(
                modelTx as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);
            vi.spyOn(modelTx, 'count').mockResolvedValue(0);

            await modelTx.findAllWithRelations(
                { destination: true },
                {},
                {},
                undefined,
                mockTx as unknown as import('../../src/types.ts').DrizzleClient
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('getClient() returns tx when provided', () => {
            const mockTx = buildMockTx();
            // Access protected method via cast for unit verification
            const result = (model as unknown as { getClient(tx?: unknown): unknown }).getClient(
                mockTx
            );
            expect(result).toBe(mockTx);
        });

        it('getClient() returns getDb() result when tx is undefined', () => {
            const mockDb = buildMockTx();
            getDb.mockReturnValue(mockDb);
            const result = (model as unknown as { getClient(tx?: unknown): unknown }).getClient(
                undefined
            );
            expect(result).toBe(mockDb);
            expect(getDb).toHaveBeenCalled();
        });
    });

    describe('findAllWithRelations', () => {
        // Add getTableName method to our dummy model for testing
        class DummyModelWithTableName extends DummyModel {
            protected getTableName(): string {
                return 'dummies';
            }
        }

        let modelWithTableName: DummyModelWithTableName;

        beforeEach(() => {
            modelWithTableName = new DummyModelWithTableName();
        });

        it('should fall back to findAll when no relations requested', async () => {
            getDb.mockReturnValue({
                select: (args?: unknown) => ({
                    from: () => ({
                        where: () => {
                            if (args && typeof args === 'object' && 'count' in args) {
                                // count query
                                return Promise.resolve([{ count: '1' }]);
                            }
                            // items query
                            const qb = {
                                limit: () => ({
                                    offset: () => Promise.resolve([{ id: '1', name: 'test' }])
                                }),
                                $dynamic: () => qb
                            };
                            return qb;
                        }
                    })
                })
            });

            const result = await modelWithTableName.findAllWithRelations({});

            expect(result).toEqual({ items: [{ id: '1', name: 'test' }], total: 1 });
            expect(logQuery).toHaveBeenCalledWith(
                'dummy',
                'findAllWithRelations',
                expect.objectContaining({ where: {}, options: {}, relations: {} }),
                'Falling back to findAll - no relations requested'
            );
        });

        it('should fall back to findAll when relations has no true values', async () => {
            getDb.mockReturnValue({
                select: (args?: unknown) => ({
                    from: () => ({
                        where: () => {
                            if (args && typeof args === 'object' && 'count' in args) {
                                // count query
                                return Promise.resolve([{ count: '1' }]);
                            }
                            // items query
                            const qb = {
                                limit: () => ({ offset: () => Promise.resolve([{ id: '1' }]) }),
                                $dynamic: () => qb
                            };
                            return qb;
                        }
                    })
                })
            });

            const result = await modelWithTableName.findAllWithRelations({
                destination: false,
                owner: false
            });

            expect(result).toEqual({ items: [{ id: '1' }], total: 1 });
            expect(logQuery).toHaveBeenCalledWith(
                'dummy',
                'findAllWithRelations',
                expect.objectContaining({
                    where: {},
                    options: {},
                    relations: { destination: false, owner: false }
                }),
                'Falling back to findAll - no relations requested'
            );
        });

        it('should use query.tableName.findMany with relations when relations requested', async () => {
            const mockFindMany = vi
                .fn()
                .mockResolvedValue([
                    { id: '1', name: 'test', destination: { id: 'd1', name: 'dest1' } }
                ]);
            vi.spyOn(modelWithTableName, 'count').mockResolvedValue(1);

            getDb.mockReturnValue({
                query: {
                    dummies: {
                        findMany: mockFindMany
                    }
                }
            });

            const result = await modelWithTableName.findAllWithRelations({
                destination: true
            });

            // Since no pagination options provided, it uses default values and includes limit/offset
            expect(mockFindMany).toHaveBeenCalledWith({
                where: undefined, // buildWhereClause returns undefined for empty object
                with: { destination: true },
                limit: 20, // default pageSize
                offset: 0 // default offset for page 1
            });
            expect(result).toEqual({
                items: [{ id: '1', name: 'test', destination: { id: 'd1', name: 'dest1' } }],
                total: 1
            });
        });

        it('should handle pagination with relations', async () => {
            const mockFindMany = vi.fn().mockResolvedValue([
                { id: '1', destination: { id: 'd1' } },
                { id: '2', destination: { id: 'd2' } }
            ]);
            vi.spyOn(modelWithTableName, 'count').mockResolvedValue(10);

            getDb.mockReturnValue({
                query: {
                    dummies: {
                        findMany: mockFindMany
                    }
                }
            });

            const result = await modelWithTableName.findAllWithRelations(
                { destination: true },
                {},
                { page: 2, pageSize: 2 }
            );

            expect(mockFindMany).toHaveBeenCalledWith({
                where: undefined, // buildWhereClause returns undefined for empty object
                with: { destination: true },
                limit: 2,
                offset: 2
            });
            expect(result.total).toBe(10);
            expect(result.items).toHaveLength(2);
        });

        it('should throw error when tableName is not defined', async () => {
            // Reset mocks for this specific test
            logError.mockClear();
            logError.mockImplementation(() => {}); // Don't throw error in logger

            // Use original DummyModel without getTableName implementation
            const modelWithoutTableName = new DummyModel();

            await expect(
                modelWithoutTableName.findAllWithRelations({ destination: true })
            ).rejects.toThrow(Error);

            expect(logError).toHaveBeenCalledWith(
                'dummy',
                'findAllWithRelations',
                expect.objectContaining({
                    where: {},
                    options: {},
                    relations: { destination: true }
                }),
                expect.any(Error)
            );
        });

        it('should throw error when query table is invalid', async () => {
            // Reset mocks for this specific test
            logError.mockClear();
            logError.mockImplementation(() => {}); // Don't throw error in logger

            getDb.mockReturnValue({
                query: {
                    dummies: null // Invalid table
                }
            });

            await expect(
                modelWithTableName.findAllWithRelations({ destination: true })
            ).rejects.toThrow(Error);
        });

        it('should throw error when findMany method is missing', async () => {
            // Reset mocks for this specific test
            logError.mockClear();
            logError.mockImplementation(() => {}); // Don't throw error in logger

            getDb.mockReturnValue({
                query: {
                    dummies: {} // Missing findMany method
                }
            });

            await expect(
                modelWithTableName.findAllWithRelations({ destination: true })
            ).rejects.toThrow(Error);
        });

        it('should handle database errors gracefully', async () => {
            // Reset mocks for this specific test
            logError.mockClear();
            logError.mockImplementation(() => {}); // Don't throw error in logger

            const mockFindMany = vi.fn().mockRejectedValue(new Error('Database connection failed'));

            getDb.mockReturnValue({
                query: {
                    dummies: {
                        findMany: mockFindMany
                    }
                }
            });

            await expect(
                modelWithTableName.findAllWithRelations({ destination: true })
            ).rejects.toThrow(Error);

            expect(logError).toHaveBeenCalledWith(
                'dummy',
                'findAllWithRelations',
                expect.objectContaining({
                    where: {},
                    options: {},
                    relations: { destination: true }
                }),
                expect.any(Error)
            );
        });

        it('should validate relations parameter', async () => {
            // Reset mocks for this specific test
            logError.mockClear();
            logError.mockImplementation(() => {}); // Don't throw error in logger

            await expect(modelWithTableName.findAllWithRelations(null as any)).rejects.toThrow(
                Error
            );

            await expect(modelWithTableName.findAllWithRelations('invalid' as any)).rejects.toThrow(
                Error
            );
        });

        it('should handle empty results from database', async () => {
            const mockFindMany = vi.fn().mockResolvedValue([]);
            vi.spyOn(modelWithTableName, 'count').mockResolvedValue(0);

            getDb.mockReturnValue({
                query: {
                    dummies: {
                        findMany: mockFindMany
                    }
                }
            });

            const result = await modelWithTableName.findAllWithRelations({
                destination: true
            });

            expect(result).toEqual({ items: [], total: 0 });
        });

        it('should log query execution with correct parameters', async () => {
            const mockFindMany = vi.fn().mockResolvedValue([{ id: '1' }]);
            vi.spyOn(modelWithTableName, 'count').mockResolvedValue(1);

            getDb.mockReturnValue({
                query: {
                    dummies: {
                        findMany: mockFindMany
                    }
                }
            });

            await modelWithTableName.findAllWithRelations(
                { destination: true, owner: true },
                { name: 'test' },
                { page: 1, pageSize: 5 }
            );

            expect(logQuery).toHaveBeenCalledWith(
                'dummy',
                'findAllWithRelations',
                expect.objectContaining({
                    where: { name: 'test' },
                    options: expect.objectContaining({
                        page: 1,
                        pageSize: 5
                    }),
                    relations: { destination: true, owner: true }
                }),
                {
                    itemCount: 1,
                    total: 1,
                    hasRelations: true
                }
            );
        });
    });

    describe('findOneWithRelations', () => {
        class DummyModelWithTableName extends DummyModel {
            protected getTableName(): string {
                return 'dummies';
            }
        }

        let modelWithTableName: DummyModelWithTableName;

        beforeEach(() => {
            modelWithTableName = new DummyModelWithTableName();
        });

        it('should fall back to findOne when no relations are requested (empty object)', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({ where: () => ({ limit: () => [{ id: '1', name: 'test' }] }) })
                })
            });

            const result = await modelWithTableName.findOneWithRelations({ id: '1' }, {});

            expect(result).toEqual({ id: '1', name: 'test' });
            expect(logQuery).toHaveBeenCalledWith(
                'dummy',
                'findOneWithRelations',
                expect.objectContaining({ where: { id: '1' }, relations: {} }),
                'Falling back to findOne - no relations requested'
            );
        });

        it('should fall back to findOne when all relation values are false', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({ where: () => ({ limit: () => [{ id: '1' }] }) })
                })
            });

            const result = await modelWithTableName.findOneWithRelations(
                { id: '1' },
                { destination: false, owner: false }
            );

            expect(result).toEqual({ id: '1' });
            expect(logQuery).toHaveBeenCalledWith(
                'dummy',
                'findOneWithRelations',
                expect.objectContaining({
                    where: { id: '1' },
                    relations: { destination: false, owner: false }
                }),
                'Falling back to findOne - no relations requested'
            );
        });

        it('should use query.tableName.findFirst with relations when relations requested', async () => {
            const mockFindFirst = vi
                .fn()
                .mockResolvedValue({ id: '1', name: 'test', destination: { id: 'd1' } });

            getDb.mockReturnValue({
                query: {
                    dummies: {
                        findFirst: mockFindFirst
                    }
                }
            });

            const result = await modelWithTableName.findOneWithRelations(
                { id: '1' },
                { destination: true }
            );

            // buildWhereClause may return an SQL object for non-empty where (depends on mock table columns)
            expect(mockFindFirst).toHaveBeenCalledWith(
                expect.objectContaining({ with: { destination: true } })
            );
            expect(result).toEqual({ id: '1', name: 'test', destination: { id: 'd1' } });
        });

        it('should return null when findFirst returns undefined (no match)', async () => {
            const mockFindFirst = vi.fn().mockResolvedValue(undefined);

            getDb.mockReturnValue({
                query: {
                    dummies: {
                        findFirst: mockFindFirst
                    }
                }
            });

            const result = await modelWithTableName.findOneWithRelations(
                { id: 'nonexistent' },
                { destination: true }
            );

            expect(result).toBeNull();
        });

        it('should log on success with hasRelations: true', async () => {
            const mockFindFirst = vi.fn().mockResolvedValue({ id: '1' });

            getDb.mockReturnValue({
                query: {
                    dummies: {
                        findFirst: mockFindFirst
                    }
                }
            });

            await modelWithTableName.findOneWithRelations({ id: '1' }, { destination: true });

            expect(logQuery).toHaveBeenCalledWith(
                'dummy',
                'findOneWithRelations',
                expect.objectContaining({
                    where: { id: '1' },
                    relations: { destination: true }
                }),
                { found: true, hasRelations: true }
            );
        });

        it('should log found: false when entity is not found', async () => {
            const mockFindFirst = vi.fn().mockResolvedValue(undefined);

            getDb.mockReturnValue({
                query: {
                    dummies: {
                        findFirst: mockFindFirst
                    }
                }
            });

            await modelWithTableName.findOneWithRelations({ id: 'missing' }, { destination: true });

            expect(logQuery).toHaveBeenCalledWith(
                'dummy',
                'findOneWithRelations',
                expect.objectContaining({ where: { id: 'missing' } }),
                { found: false, hasRelations: true }
            );
        });

        it('should throw DbError when tableName is not defined', async () => {
            logError.mockImplementation(() => {});

            // DummyModel.getTableName() throws, which causes findOneWithRelations to throw DbError
            await expect(
                model.findOneWithRelations({ id: '1' }, { destination: true })
            ).rejects.toThrow(DbError);

            expect(logError).toHaveBeenCalledWith(
                'dummy',
                'findOneWithRelations',
                expect.objectContaining({ where: { id: '1' }, relations: { destination: true } }),
                expect.any(Error)
            );
        });

        it('should throw DbError when query table is null', async () => {
            logError.mockImplementation(() => {});

            getDb.mockReturnValue({
                query: { dummies: null }
            });

            await expect(
                modelWithTableName.findOneWithRelations({ id: '1' }, { destination: true })
            ).rejects.toThrow(DbError);
        });

        it('should throw DbError when findFirst method is missing from query table', async () => {
            logError.mockImplementation(() => {});

            getDb.mockReturnValue({
                query: { dummies: {} }
            });

            await expect(
                modelWithTableName.findOneWithRelations({ id: '1' }, { destination: true })
            ).rejects.toThrow(DbError);
        });

        it('should throw DbError and log on database error', async () => {
            logError.mockImplementation(() => {});
            const mockFindFirst = vi
                .fn()
                .mockRejectedValue(new Error('Database connection failed'));

            getDb.mockReturnValue({
                query: { dummies: { findFirst: mockFindFirst } }
            });

            await expect(
                modelWithTableName.findOneWithRelations({ id: '1' }, { destination: true })
            ).rejects.toThrow(DbError);

            expect(logError).toHaveBeenCalledWith(
                'dummy',
                'findOneWithRelations',
                expect.objectContaining({ where: { id: '1' }, relations: { destination: true } }),
                expect.any(Error)
            );
        });

        it('should pass tx to getClient()', async () => {
            const mockFindFirst = vi.fn().mockResolvedValue({ id: '1' });
            const mockTx = {
                query: { dummies: { findFirst: mockFindFirst } }
            } as unknown as import('../../src/types.ts').DrizzleClient;

            const getClientSpy = vi.spyOn(
                modelWithTableName as unknown as { getClient(tx?: unknown): unknown },
                'getClient'
            );
            getClientSpy.mockReturnValue(mockTx);

            await modelWithTableName.findOneWithRelations(
                { id: '1' },
                { destination: true },
                mockTx
            );

            expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        });

        it('should handle nested relations via transformRelationsForDrizzle', async () => {
            const mockFindFirst = vi.fn().mockResolvedValue({
                id: '1',
                sponsorship: { id: 's1', sponsor: { id: 'sp1' } }
            });

            getDb.mockReturnValue({
                query: { dummies: { findFirst: mockFindFirst } }
            });

            const result = await modelWithTableName.findOneWithRelations(
                { id: '1' },
                { sponsorship: { sponsor: true } }
            );

            // Nested relation { sponsor: true } should be transformed to { with: { sponsor: true } }
            // where may be an SQL object depending on the mock table structure — use objectContaining
            expect(mockFindFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    with: { sponsorship: { with: { sponsor: true } } }
                })
            );
            expect(result).toEqual({
                id: '1',
                sponsorship: { id: 's1', sponsor: { id: 'sp1' } }
            });
        });

        it('should validate relations parameter and throw DbError for invalid type', async () => {
            logError.mockImplementation(() => {});

            await expect(
                // @ts-expect-error testing runtime validation with invalid type
                modelWithTableName.findOneWithRelations({ id: '1' }, null)
            ).rejects.toThrow(DbError);
        });
    });
});
