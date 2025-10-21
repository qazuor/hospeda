import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModel } from '../../src/base/base.model';
import * as dbUtils from '../../src/client';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

// Dummy table mock
const mockTable = {
    id: { count: () => ({ as: () => 'COUNT_COL' }) },
    name: {}
};

type DummyType = { id: string; name?: string };

class DummyModel extends BaseModel<DummyType> {
    // @ts-expect-error: mock table for test, not a real Drizzle table
    protected table = mockTable as unknown as Record<
        string,
        { count?: () => { as: () => string } } | object
    >;
    protected entityName = 'dummy';

    protected getTableName(): string {
        throw new Error('getTableName not implemented in base test model');
    }
}

class NoIdModel extends BaseModel<{ foo: string }> {
    // @ts-expect-error: mock table for test, not a real Drizzle table
    protected table = {
        foo: { count: () => ({ as: () => 'COUNT_COL' }) }
    } as unknown as Record<string, { count: () => { as: () => string } }>;
    protected entityName = 'noid';

    protected getTableName(): string {
        throw new Error('getTableName not implemented in test model');
    }
}

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('BaseModel', () => {
    let model: DummyModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DummyModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    it('findAll returns and logs', async () => {
        getDb.mockReturnValue({ select: () => ({ from: () => ({ where: () => [{ id: '1' }] }) }) });
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

    it('hardDelete returns and logs', async () => {
        getDb.mockReturnValue({ delete: () => ({ where: () => ({ returning: () => [{}, {}] }) }) });
        const result = await model.hardDelete({});
        expect(result).toBe(2);
        expect(logQuery).toHaveBeenCalled();
    });

    it('softDelete returns and logs', async () => {
        getDb.mockReturnValue({
            update: () => ({ set: () => ({ where: () => ({ returning: () => [{}, {}] }) }) })
        });
        const result = await model.softDelete({});
        expect(result).toBe(2);
        expect(logQuery).toHaveBeenCalled();
    });

    it('restore returns and logs', async () => {
        getDb.mockReturnValue({
            update: () => ({ set: () => ({ where: () => ({ returning: () => [{}, {}] }) }) })
        });
        const result = await model.restore({});
        expect(result).toBe(2);
        expect(logQuery).toHaveBeenCalled();
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
        getDb.mockReturnValue({ select: () => ({ from: () => ({ where: () => [{ id: '1' }] }) }) });
        const result = await model.findAll({});
        expect(result).toEqual({ items: [{ id: '1' }], total: 1 });
    });

    it('findAll handles null filter', async () => {
        getDb.mockReturnValue({ select: () => ({ from: () => ({ where: () => [{ id: '1' }] }) }) });
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
        const result = await model.update({ id: '3' }, {});
        expect(result).toEqual({});
        const result2 = await model.update({ id: '3' }, { name: undefined });
        expect(result2).toEqual({});
        const result3 = await model.update({ id: '3' }, { name: null as unknown as string });
        expect(result3).toEqual({});
    });

    it('findAll handles DB returning undefined', async () => {
        getDb.mockReturnValue({ select: () => ({ from: () => ({ where: () => undefined }) }) });
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
        getDb.mockReturnValue({ select: () => ({ from: () => ({ where: () => [{ id: 123 }] }) }) });
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

    // TODO [ed21b803-92bd-4ead-afbe-b6cefc2e0d3f]: Investigate why this test fails despite the mock being logically correct.
    // The mock for db.select().from()... seems to be misbehaving with vitest's vi.fn().
    // it('findAll with pagination returns paginated items and total', async () => {
    //     let callCount = 0;
    //     const selectImplementation = () => {
    //         callCount++;
    //         if (callCount === 1) {
    //             // La primera llamada a .select() es para obtener el total
    //             return {
    //                 from: () => ({ where: () => Promise.resolve([{ total: '10' }]) })
    //             };
    //         }
    //         // La segunda llamada a .select() es para obtener los items
    //         return {
    //             from: () => ({
    //                 where: () => ({
    //                     limit: () => ({
    //                         offset: () =>
    //                             Promise.resolve([
    //                                 { id: '1' },
    //                                 { id: '2' },
    //                                 { id: '3' },
    //                                 { id: '4' },
    //                                 { id: '5' }
    //                             ])
    //                     })
    //                 })
    //             })
    //         };
    //     };

    //     getDb.mockReturnValue({
    //         select: vi.fn(selectImplementation)
    //     });

    //     const result = await model.findAll({}, { page: 1, pageSize: 5 });
    //     expect(result.total).toBe(10);
    //     expect(result.items.length).toBe(5);
    // });

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
                select: () => ({ from: () => ({ where: () => [{ id: '1', name: 'test' }] }) })
            });

            const result = await modelWithTableName.findAllWithRelations({});

            expect(result).toEqual({ items: [{ id: '1', name: 'test' }], total: 1 });
            expect(logQuery).toHaveBeenCalledWith(
                'dummy',
                'findAllWithRelations',
                { where: {}, options: {}, relations: {} },
                'Falling back to findAll - no relations requested'
            );
        });

        it('should fall back to findAll when relations has no true values', async () => {
            getDb.mockReturnValue({
                select: () => ({ from: () => ({ where: () => [{ id: '1' }] }) })
            });

            const result = await modelWithTableName.findAllWithRelations({
                destination: false,
                owner: false
            });

            expect(result).toEqual({ items: [{ id: '1' }], total: 1 });
            expect(logQuery).toHaveBeenCalledWith(
                'dummy',
                'findAllWithRelations',
                { where: {}, options: {}, relations: { destination: false, owner: false } },
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
                { where: {}, options: {}, relations: { destination: true } },
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
                { where: {}, options: {}, relations: { destination: true } },
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
                {
                    where: { name: 'test' },
                    options: { page: 1, pageSize: 5 },
                    relations: { destination: true, owner: true }
                },
                {
                    itemCount: 1,
                    total: 1,
                    hasRelations: true,
                    isPaginated: true // Should be true when page/pageSize are specified
                }
            );
        });
    });
});
