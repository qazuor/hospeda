import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { OwnerPromotionModel } from '../../src/models/owner-promotion/ownerPromotion.model';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('OwnerPromotionModel', () => {
    let model: OwnerPromotionModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let _logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new OwnerPromotionModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        _logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(OwnerPromotionModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('ownerPromotions');
        });
    });

    describe('findBySlug', () => {
        it('should return a promotion when found', async () => {
            const mockPromotion = { id: '1', slug: 'test-promo', name: 'Test Promo' };
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([mockPromotion])
                        })
                    })
                })
            };
            getDb.mockReturnValue(db);

            const result = await model.findBySlug('test-promo');

            expect(result).toEqual(mockPromotion);
            expect(logQuery).toHaveBeenCalledWith(
                'ownerPromotions',
                'findBySlug',
                { slug: 'test-promo' },
                [mockPromotion]
            );
        });

        it('should return null when not found', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            };
            getDb.mockReturnValue(db);

            const result = await model.findBySlug('nonexistent');
            expect(result).toBeNull();
        });

        it('should throw DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockRejectedValue(new Error('db fail'))
                        })
                    })
                })
            };
            getDb.mockReturnValue(db);

            await expect(model.findBySlug('fail')).rejects.toThrow(DbError);
        });
    });

    describe('findWithRelations', () => {
        it('should return result with relations when relations requested', async () => {
            const mockResult = { id: '1', name: 'Promo', owner: { id: 'o1' } };
            const db = {
                query: {
                    ownerPromotions: {
                        findFirst: vi.fn().mockResolvedValue(mockResult)
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findWithRelations({ id: '1' }, { owner: true });

            expect(result).toEqual(mockResult);
            expect(db.query.ownerPromotions.findFirst).toHaveBeenCalled();
        });

        it('should fall back to findOne when no relations requested', async () => {
            const mockResult = { id: '1', name: 'Promo' };
            const mockFindOne = vi.spyOn(model, 'findOne').mockResolvedValue(mockResult as never);

            const result = await model.findWithRelations({ id: '1' }, {});

            expect(result).toEqual(mockResult);
            expect(mockFindOne).toHaveBeenCalledWith({ id: '1' }, undefined);

            mockFindOne.mockRestore();
        });

        it('should thread tx to findOne when no relations requested', async () => {
            const mockResult = { id: '1', name: 'Promo' };
            const mockTx = {} as never;
            const mockFindOne = vi.spyOn(model, 'findOne').mockResolvedValue(mockResult as never);

            await model.findWithRelations({ id: '1' }, {}, mockTx);

            expect(mockFindOne).toHaveBeenCalledWith({ id: '1' }, mockTx);

            mockFindOne.mockRestore();
        });

        it('should throw DbError on database failure', async () => {
            const db = {
                query: {
                    ownerPromotions: {
                        findFirst: vi.fn().mockRejectedValue(new Error('db fail'))
                    }
                }
            };
            getDb.mockReturnValue(db);

            await expect(model.findWithRelations({ id: '1' }, { owner: true })).rejects.toThrow(
                DbError
            );
        });
    });

    describe('findActiveByAccommodationId', () => {
        it('should return active promotions for accommodation', async () => {
            const mockResult = [{ id: '1', accommodationId: 'a1', isActive: true }];
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue(mockResult)
                    })
                })
            };
            getDb.mockReturnValue(db);

            const result = await model.findActiveByAccommodationId('a1');

            expect(result.items).toEqual(mockResult);
            expect(result.total).toBe(1);
        });

        it('should throw DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('db fail'))
                    })
                })
            };
            getDb.mockReturnValue(db);

            await expect(model.findActiveByAccommodationId('a1')).rejects.toThrow(DbError);
        });
    });

    describe('findActiveByOwnerId', () => {
        it('should return active promotions for owner', async () => {
            const mockResult = [{ id: '1', ownerId: 'o1', isActive: true }];
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue(mockResult)
                    })
                })
            };
            getDb.mockReturnValue(db);

            const result = await model.findActiveByOwnerId('o1');

            expect(result.items).toEqual(mockResult);
            expect(result.total).toBe(1);
        });

        it('should throw DbError on database failure', async () => {
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('db fail'))
                    })
                })
            };
            getDb.mockReturnValue(db);

            await expect(model.findActiveByOwnerId('o1')).rejects.toThrow(DbError);
        });
    });

    describe('findByOwnerId', () => {
        it('should delegate to findAll with correct where clause', async () => {
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [{ id: '1', ownerId: 'o1' } as never],
                total: 1
            });

            const result = await model.findByOwnerId('o1');

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(mockFindAll).toHaveBeenCalledWith(
                { ownerId: 'o1', deletedAt: null },
                undefined,
                undefined,
                undefined
            );

            mockFindAll.mockRestore();
        });

        it('should thread tx to findAll as 4th positional argument', async () => {
            const mockTx = {} as never;
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [],
                total: 0
            });

            await model.findByOwnerId('o1', mockTx);

            expect(mockFindAll).toHaveBeenCalledWith(
                { ownerId: 'o1', deletedAt: null },
                undefined,
                undefined,
                mockTx
            );

            mockFindAll.mockRestore();
        });

        it('should throw DbError on database failure', async () => {
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('db fail'));

            await expect(model.findByOwnerId('o1')).rejects.toThrow(DbError);
        });
    });
});
