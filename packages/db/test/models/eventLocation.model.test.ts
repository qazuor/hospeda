import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { EventLocationModel } from '../../src/models/event/eventLocation.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('EventLocationModel', () => {
    let model: EventLocationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new EventLocationModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('eventLocations');
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
                                            { id: '1', city: 'Buenos Aires' },
                                            { id: '2', city: 'Rosario' }
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
                    { id: '1', city: 'Buenos Aires' },
                    { id: '2', city: 'Rosario' }
                ],
                total: 2
            });
            expect(logQuery).toHaveBeenCalled();
        });

        it('should pass filters to where clause', async () => {
            getDb.mockReturnValue({
                select: (args?: unknown) => ({
                    from: () => ({
                        where: () => {
                            if (args && typeof args === 'object' && 'count' in args) {
                                return Promise.resolve([{ count: '1' }]);
                            }
                            const qb = {
                                limit: () => ({
                                    offset: () => Promise.resolve([{ id: '1', city: 'Rosario' }])
                                }),
                                $dynamic: () => qb
                            };
                            return qb;
                        }
                    })
                })
            });

            const result = await model.findAll({ city: 'Rosario' });

            expect(result.items).toHaveLength(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('findById', () => {
        it('should find a location by id', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () => [
                                { id: 'loc1', slug: 'test-location', city: 'Buenos Aires' }
                            ]
                        })
                    })
                })
            });

            const result = await model.findById('loc1');

            expect(result).toEqual({ id: 'loc1', slug: 'test-location', city: 'Buenos Aires' });
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

    describe('findOne', () => {
        it('should find a location by slug', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () => [{ id: 'loc1', slug: 'unique-slug', city: 'Rosario' }]
                        })
                    })
                })
            });

            const result = await model.findOne({ slug: 'unique-slug' });

            expect(result).toEqual({ id: 'loc1', slug: 'unique-slug', city: 'Rosario' });
            expect(logQuery).toHaveBeenCalled();
        });

        it('should return null when no match found', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({ where: () => ({ limit: () => [] }) })
                })
            });

            const result = await model.findOne({ slug: 'non-existent' });

            expect(result).toBeNull();
        });
    });

    describe('count', () => {
        it('should return the count', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => Promise.resolve([{ count: '3' }])
                    })
                })
            });

            const result = await model.count({});

            expect(result).toBe(3);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update and return the entity', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({
                            returning: () => [{ id: 'loc1', city: 'Updated City' }]
                        })
                    })
                })
            });

            const result = await model.update({ id: 'loc1' }, { city: 'Updated City' });

            expect(result).toEqual({ id: 'loc1', city: 'Updated City' });
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('softDelete', () => {
        it('should soft delete and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 'loc1' }] })
                    })
                })
            });

            const result = await model.softDelete({ id: 'loc1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        it('should restore and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 'loc1' }] })
                    })
                })
            });

            const result = await model.restore({ id: 'loc1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('should hard delete and return count', async () => {
            getDb.mockReturnValue({
                delete: () => ({
                    where: () => ({ returning: () => [{ id: 'loc1' }] })
                })
            });

            const result = await model.hardDelete({ id: 'loc1' });

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
});
