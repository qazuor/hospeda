import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AttractionModel } from '../../src/models/destination/attraction.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('AttractionModel', () => {
    let model: AttractionModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AttractionModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('attractions');
        });
    });

    describe('findAll', () => {
        it('should return items and total', async () => {
            getDb.mockReturnValue({
                select: (args?: unknown) => ({
                    from: () => ({
                        where: () => {
                            if (args && typeof args === 'object' && 'count' in args) {
                                return Promise.resolve([{ count: '2' }]);
                            }
                            const qb = {
                                limit: () => ({
                                    offset: () =>
                                        Promise.resolve([
                                            { id: '1', name: 'Beach' },
                                            { id: '2', name: 'Park' }
                                        ])
                                }),
                                $dynamic: () => qb
                            };
                            return qb;
                        }
                    })
                })
            });

            const result = await model.findAll({});

            expect(result).toEqual({
                items: [
                    { id: '1', name: 'Beach' },
                    { id: '2', name: 'Park' }
                ],
                total: 2
            });
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('findById', () => {
        it('should find an attraction by id', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({ limit: () => [{ id: 'a1', name: 'Museum' }] })
                    })
                })
            });

            const result = await model.findById('a1');

            expect(result).toEqual({ id: 'a1', name: 'Museum' });
            expect(logQuery).toHaveBeenCalled();
        });

        it('should return null for non-existent id', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({ where: () => ({ limit: () => [] }) })
                })
            });

            const result = await model.findById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('count', () => {
        it('should return the count', async () => {
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
    });

    describe('update', () => {
        it('should update and return the entity', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({
                            returning: () => [{ id: 'a1', name: 'Updated Museum' }]
                        })
                    })
                })
            });

            const result = await model.update({ id: 'a1' }, { name: 'Updated Museum' });

            expect(result).toEqual({ id: 'a1', name: 'Updated Museum' });
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('softDelete', () => {
        it('should soft delete and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 'a1' }] })
                    })
                })
            });

            const result = await model.softDelete({ id: 'a1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        it('should restore and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 'a1' }] })
                    })
                })
            });

            const result = await model.restore({ id: 'a1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('should hard delete and return count', async () => {
            getDb.mockReturnValue({
                delete: () => ({
                    where: () => ({ returning: () => [{ id: 'a1' }] })
                })
            });

            const result = await model.hardDelete({ id: 'a1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should throw DbError on database failure', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => {
                            throw new Error('connection failed');
                        }
                    })
                })
            });

            await expect(model.findAll({})).rejects.toThrow('connection failed');
            expect(logError).toHaveBeenCalled();
        });
    });

    describe('findAllWithRelations', () => {
        it('should fall back to findAll when no relations specified', async () => {
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [{ id: '1', name: 'Beach' } as never],
                total: 1
            });

            const result = await model.findAllWithRelations({});

            expect(mockFindAll).toHaveBeenCalledWith({}, {});
            expect(result.items).toHaveLength(1);
            expect(logQuery).toHaveBeenCalledWith(
                'attractions',
                'findAllWithRelations',
                expect.objectContaining({ relations: {} }),
                'Falling back to findAll - no relations requested'
            );

            mockFindAll.mockRestore();
        });

        it('should use query.attractions.findMany with relations', async () => {
            const mockFindMany = vi
                .fn()
                .mockResolvedValue([{ id: '1', name: 'Beach', destination: { id: 'd1' } }]);
            vi.spyOn(model, 'count').mockResolvedValue(1);

            getDb.mockReturnValue({
                query: {
                    attractions: {
                        findMany: mockFindMany
                    }
                }
            });

            const result = await model.findAllWithRelations({ destination: true });

            expect(mockFindMany).toHaveBeenCalledWith({
                where: undefined,
                with: { destination: true },
                limit: 20,
                offset: 0
            });
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });
});
