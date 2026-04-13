import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { EventOrganizerModel } from '../../src/models/event/eventOrganizer.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('EventOrganizerModel', () => {
    let model: EventOrganizerModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new EventOrganizerModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        model.findOne = mockFindOne;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName: () => string }).getTableName();
            expect(tableName).toBe('eventOrganizers');
        });
    });

    describe('findWithRelations', () => {
        it('should return result with relations and log', async () => {
            const db = {
                query: {
                    eventOrganizers: {
                        findFirst: vi.fn().mockResolvedValue({
                            id: 'org1',
                            name: 'Test Organizer',
                            events: [{ id: 'ev1' }]
                        })
                    }
                }
            };
            getDb.mockReturnValue(db);

            const where = { id: 'org1' };
            const relations = { events: true };
            const result = await model.findWithRelations(where, relations);

            expect(result).toEqual({
                id: 'org1',
                name: 'Test Organizer',
                events: [{ id: 'ev1' }]
            });
            expect(db.query.eventOrganizers.findFirst).toHaveBeenCalled();
            expect(logQuery).toHaveBeenCalledWith(
                'eventOrganizers',
                'findWithRelations',
                { where, relations },
                { id: 'org1', name: 'Test Organizer', events: [{ id: 'ev1' }] }
            );
        });

        it('should fall back to findOne when no relations requested', async () => {
            getDb.mockReturnValue({});
            const where = { id: 'org2' };
            const relations = { events: false };
            mockFindOne.mockResolvedValue({ id: 'org2', name: 'Organizer 2' });

            const result = await model.findWithRelations(where, relations);

            expect(result).toEqual({ id: 'org2', name: 'Organizer 2' });
            expect(mockFindOne).toHaveBeenCalledWith(where, undefined);
            expect(logQuery).toHaveBeenCalledWith(
                'eventOrganizers',
                'findWithRelations',
                { where, relations },
                { id: 'org2', name: 'Organizer 2' }
            );
        });

        it('should log and throw on error', async () => {
            const db = {
                query: {
                    eventOrganizers: {
                        findFirst: vi.fn().mockRejectedValue(new Error('db error'))
                    }
                }
            };
            getDb.mockReturnValue(db);

            const where = { id: 'org3' };
            const relations = { events: true };

            await expect(model.findWithRelations(where, relations)).rejects.toThrow('db error');
            expect(logError).toHaveBeenCalledWith(
                'eventOrganizers',
                'findWithRelations',
                { where, relations },
                expect.any(Error)
            );
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
                                            { id: 'org1', name: 'Organizer 1' },
                                            { id: 'org2', name: 'Organizer 2' }
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
                    { id: 'org1', name: 'Organizer 1' },
                    { id: 'org2', name: 'Organizer 2' }
                ],
                total: 2
            });
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('findById', () => {
        it('should find an organizer by id', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () => [{ id: 'org1', name: 'Test Organizer' }]
                        })
                    })
                })
            });

            const result = await model.findById('org1');

            expect(result).toEqual({ id: 'org1', name: 'Test Organizer' });
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
                        where: () => Promise.resolve([{ count: '10' }])
                    })
                })
            });

            const result = await model.count({});

            expect(result).toBe(10);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('softDelete', () => {
        it('should soft delete and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 'org1' }] })
                    })
                })
            });

            const result = await model.softDelete({ id: 'org1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        it('should restore and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 'org1' }] })
                    })
                })
            });

            const result = await model.restore({ id: 'org1' });

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

    // ========================================================================
    // T-049: tx propagation for EventOrganizerModel
    // ========================================================================
    describe('tx propagation', () => {
        it('findWithRelations() uses tx when provided (with relations branch)', async () => {
            // Arrange
            const findFirst = vi.fn().mockResolvedValue({ id: 'org1', events: [] });
            const mockTx = { query: { eventOrganizers: { findFirst } } } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ id: 'org1' }, { events: true }, mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });

        it('findWithRelations() threads tx to findOne in fallback branch', async () => {
            // Arrange
            const mockTx = {} as any;
            const findOneSpy = vi.spyOn(model, 'findOne').mockResolvedValue({ id: 'org1' } as any);
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ id: 'org1' }, { events: false }, mockTx);

            // Assert
            expect(findOneSpy).toHaveBeenCalledWith({ id: 'org1' }, mockTx);

            spy.mockRestore();
            findOneSpy.mockRestore();
        });
    });
});
