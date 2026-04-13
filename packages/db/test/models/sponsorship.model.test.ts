import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { SponsorshipModel } from '../../src/models/sponsorship/sponsorship.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('SponsorshipModel', () => {
    let model: SponsorshipModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new SponsorshipModel();
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
            expect(tableName).toBe('sponsorships');
        });
    });

    describe('findBySlug', () => {
        it('should find a sponsorship by slug', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () =>
                                Promise.resolve([
                                    { id: 's1', slug: 'test-sponsorship', status: 'active' }
                                ])
                        })
                    })
                })
            });

            const result = await model.findBySlug('test-sponsorship');

            expect(result).toEqual({ id: 's1', slug: 'test-sponsorship', status: 'active' });
            expect(logQuery).toHaveBeenCalledWith(
                'sponsorships',
                'findBySlug',
                { slug: 'test-sponsorship' },
                expect.any(Array)
            );
        });

        it('should return null for non-existent slug', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({ limit: () => Promise.resolve([]) })
                    })
                })
            });

            const result = await model.findBySlug('non-existent');

            expect(result).toBeNull();
        });

        it('should throw on database error', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({ limit: () => Promise.reject(new Error('db error')) })
                    })
                })
            });

            await expect(model.findBySlug('fail')).rejects.toThrow('db error');
            expect(logError).toHaveBeenCalledWith(
                'sponsorships',
                'findBySlug',
                { slug: 'fail' },
                expect.any(Error)
            );
        });
    });

    describe('findBySponsorUserId', () => {
        it('should find sponsorships by sponsor user id', async () => {
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [{ id: 's1', sponsorUserId: 'user1' } as never],
                total: 1
            });

            const result = await model.findBySponsorUserId('user1');

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(mockFindAll).toHaveBeenCalledWith(
                { sponsorUserId: 'user1', deletedAt: null },
                undefined,
                undefined,
                undefined
            );
            expect(logQuery).toHaveBeenCalledWith(
                'sponsorships',
                'findBySponsorUserId',
                { sponsorUserId: 'user1' },
                expect.any(Object)
            );

            mockFindAll.mockRestore();
        });

        it('should thread tx to findAll as 4th positional argument', async () => {
            const mockTx = {} as never;
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            await model.findBySponsorUserId('user1', mockTx);

            expect(mockFindAll).toHaveBeenCalledWith(
                { sponsorUserId: 'user1', deletedAt: null },
                undefined,
                undefined,
                mockTx
            );

            mockFindAll.mockRestore();
        });

        it('should throw on database error', async () => {
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('db error'));

            await expect(model.findBySponsorUserId('user1')).rejects.toThrow('db error');
            expect(logError).toHaveBeenCalledWith(
                'sponsorships',
                'findBySponsorUserId',
                { sponsorUserId: 'user1' },
                expect.any(Error)
            );
        });
    });

    describe('findActiveByTarget', () => {
        it('should find active sponsorships by target', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () =>
                            Promise.resolve([
                                { id: 's1', targetType: 'post', targetId: 'p1', status: 'active' }
                            ])
                    })
                })
            });

            const result = await model.findActiveByTarget('post', 'p1');

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(logQuery).toHaveBeenCalledWith(
                'sponsorships',
                'findActiveByTarget',
                { targetType: 'post', targetId: 'p1' },
                expect.any(Array)
            );
        });

        it('should return empty when no active sponsorships found', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => Promise.resolve([])
                    })
                })
            });

            const result = await model.findActiveByTarget('post', 'p1');

            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('should throw on database error', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => Promise.reject(new Error('db error'))
                    })
                })
            });

            await expect(model.findActiveByTarget('post', 'p1')).rejects.toThrow('db error');
            expect(logError).toHaveBeenCalledWith(
                'sponsorships',
                'findActiveByTarget',
                { targetType: 'post', targetId: 'p1' },
                expect.any(Error)
            );
        });
    });

    describe('findByStatus', () => {
        it('should find sponsorships by status', async () => {
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [{ id: 's1', status: 'active' } as never],
                total: 1
            });

            const result = await model.findByStatus('active');

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(mockFindAll).toHaveBeenCalledWith(
                { status: 'active', deletedAt: null },
                undefined,
                undefined,
                undefined
            );
            expect(logQuery).toHaveBeenCalledWith(
                'sponsorships',
                'findByStatus',
                { status: 'active' },
                expect.any(Object)
            );

            mockFindAll.mockRestore();
        });

        it('should thread tx to findAll as 4th positional argument', async () => {
            const mockTx = {} as never;
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            await model.findByStatus('active', mockTx);

            expect(mockFindAll).toHaveBeenCalledWith(
                { status: 'active', deletedAt: null },
                undefined,
                undefined,
                mockTx
            );

            mockFindAll.mockRestore();
        });

        it('should throw on database error', async () => {
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('db error'));

            await expect(model.findByStatus('active')).rejects.toThrow('db error');
            expect(logError).toHaveBeenCalledWith(
                'sponsorships',
                'findByStatus',
                { status: 'active' },
                expect.any(Error)
            );
        });
    });

    describe('findWithRelations', () => {
        it('should return result with relations', async () => {
            const db = {
                query: {
                    sponsorships: {
                        findFirst: vi.fn().mockResolvedValue({
                            id: 's1',
                            sponsorUser: { id: 'u1', name: 'Test User' }
                        })
                    }
                }
            };
            getDb.mockReturnValue(db);

            const where = { id: 's1' };
            const relations = { sponsorUser: true };
            const result = await model.findWithRelations(where, relations);

            expect(result).toEqual({
                id: 's1',
                sponsorUser: { id: 'u1', name: 'Test User' }
            });
            expect(db.query.sponsorships.findFirst).toHaveBeenCalled();
            expect(logQuery).toHaveBeenCalledWith(
                'sponsorships',
                'findWithRelations',
                { where, relations },
                { id: 's1', sponsorUser: { id: 'u1', name: 'Test User' } }
            );
        });

        it('should fall back to findOne when no relations requested', async () => {
            getDb.mockReturnValue({});
            const where = { id: 's2' };
            const relations = { sponsorUser: false };
            mockFindOne.mockResolvedValue({ id: 's2', status: 'active' });

            const result = await model.findWithRelations(where, relations);

            expect(result).toEqual({ id: 's2', status: 'active' });
            expect(mockFindOne).toHaveBeenCalledWith(where, undefined);
            expect(logQuery).toHaveBeenCalledWith(
                'sponsorships',
                'findWithRelations',
                { where, relations },
                { id: 's2', status: 'active' }
            );
        });

        it('should log and throw on error', async () => {
            const db = {
                query: {
                    sponsorships: {
                        findFirst: vi.fn().mockRejectedValue(new Error('db error'))
                    }
                }
            };
            getDb.mockReturnValue(db);

            const where = { id: 's3' };
            const relations = { sponsorUser: true };

            await expect(model.findWithRelations(where, relations)).rejects.toThrow('db error');
            expect(logError).toHaveBeenCalledWith(
                'sponsorships',
                'findWithRelations',
                { where, relations },
                expect.any(Error)
            );
        });
    });

    // ========================================================================
    // T-048: tx propagation — methods not yet covered
    // ========================================================================
    describe('tx propagation', () => {
        it('findBySlug() uses tx when provided', async () => {
            // Arrange
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([{ id: 's1', slug: 'gold' }])
                        })
                    })
                })
            } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            const result = await model.findBySlug('gold', mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();
            expect(result).toEqual({ id: 's1', slug: 'gold' });

            spy.mockRestore();
        });

        it('findActiveByTarget() uses tx when provided', async () => {
            // Arrange
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([{ id: 's1' }])
                    })
                })
            } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findActiveByTarget('post', 'p1', mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });

        it('findWithRelations() uses tx for query branch (with relations)', async () => {
            // Arrange
            const findFirst = vi.fn().mockResolvedValue({ id: 's1', sponsorUser: { id: 'u1' } });
            const mockTx = { query: { sponsorships: { findFirst } } } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ id: 's1' }, { sponsorUser: true }, mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(getDb).not.toHaveBeenCalled();

            spy.mockRestore();
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
                                            { id: 's1', status: 'active' },
                                            { id: 's2', status: 'expired' }
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
                    { id: 's1', status: 'active' },
                    { id: 's2', status: 'expired' }
                ],
                total: 2
            });
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('findById', () => {
        it('should find a sponsorship by id', async () => {
            getDb.mockReturnValue({
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () => [{ id: 's1', status: 'active' }]
                        })
                    })
                })
            });

            const result = await model.findById('s1');

            expect(result).toEqual({ id: 's1', status: 'active' });
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

    describe('softDelete', () => {
        it('should soft delete and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 's1' }] })
                    })
                })
            });

            const result = await model.softDelete({ id: 's1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });

    describe('restore', () => {
        it('should restore and return count', async () => {
            getDb.mockReturnValue({
                update: () => ({
                    set: () => ({
                        where: () => ({ returning: () => [{ id: 's1' }] })
                    })
                })
            });

            const result = await model.restore({ id: 's1' });

            expect(result).toBe(1);
            expect(logQuery).toHaveBeenCalled();
        });
    });
});
