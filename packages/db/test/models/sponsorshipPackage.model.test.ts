import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { SponsorshipPackageModel } from '../../src/models/sponsorship/sponsorshipPackage.model';
import type { DrizzleClient } from '../../src/types';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('SponsorshipPackageModel', () => {
    let model: SponsorshipPackageModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let _logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new SponsorshipPackageModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        _logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(SponsorshipPackageModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('sponsorshipPackages');
        });
    });

    describe('findBySlug', () => {
        it('should return a sponsorship package when found', async () => {
            const mockPackage = { id: '1', slug: 'premium', name: 'Premium Package' };
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([mockPackage])
                        })
                    })
                })
            };
            getDb.mockReturnValue(db);

            const result = await model.findBySlug('premium');

            expect(result).toEqual(mockPackage);
            expect(logQuery).toHaveBeenCalledWith(
                'sponsorshipPackages',
                'findBySlug',
                { slug: 'premium' },
                [mockPackage]
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

        it('should use provided tx client instead of getDb', async () => {
            const mockPackage = { id: '1', slug: 'premium', name: 'Premium Package' };
            const txClient = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([mockPackage])
                        })
                    })
                })
            } as unknown as DrizzleClient;

            const result = await model.findBySlug('premium', txClient);

            expect(result).toEqual(mockPackage);
            expect(getDb).not.toHaveBeenCalled();
            expect(txClient.select).toHaveBeenCalled();
        });
    });

    describe('findActive', () => {
        it('should delegate to findAll with correct where clause', async () => {
            const mockResult = { items: [], total: 0 };
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue(mockResult);

            await model.findActive();

            expect(mockFindAll).toHaveBeenCalledWith(
                { isActive: true, deletedAt: null },
                undefined,
                undefined,
                undefined
            );

            mockFindAll.mockRestore();
        });

        it('should pass tx as 4th positional argument to findAll', async () => {
            const mockResult = { items: [], total: 0 };
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue(mockResult);
            const txClient = {} as unknown as DrizzleClient;

            await model.findActive(txClient);

            expect(mockFindAll).toHaveBeenCalledWith(
                { isActive: true, deletedAt: null },
                undefined,
                undefined,
                txClient
            );

            mockFindAll.mockRestore();
        });

        it('should throw DbError on failure', async () => {
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('db fail'));

            await expect(model.findActive()).rejects.toThrow(DbError);
        });
    });

    describe('findWithRelations', () => {
        it('should return result with relations when relations requested', async () => {
            const mockResult = { id: '1', name: 'Premium', eventLevel: { id: 'l1' } };
            const db = {
                query: {
                    sponsorshipPackages: {
                        findFirst: vi.fn().mockResolvedValue(mockResult)
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findWithRelations({ id: '1' }, { eventLevel: true });

            expect(result).toEqual(mockResult);
            expect(db.query.sponsorshipPackages.findFirst).toHaveBeenCalled();
        });

        it('should fall back to findOne when no relations requested', async () => {
            const mockResult = { id: '1', name: 'Premium' };
            const mockFindOne = vi.spyOn(model, 'findOne').mockResolvedValue(mockResult as never);

            const result = await model.findWithRelations({ id: '1' }, {});

            expect(result).toEqual(mockResult);
            expect(mockFindOne).toHaveBeenCalledWith({ id: '1' }, undefined);

            mockFindOne.mockRestore();
        });

        it('should pass tx to findOne when no relations requested', async () => {
            const mockResult = { id: '1', name: 'Premium' };
            const txClient = {} as unknown as DrizzleClient;
            const mockFindOne = vi.spyOn(model, 'findOne').mockResolvedValue(mockResult as never);

            await model.findWithRelations({ id: '1' }, {}, txClient);

            expect(mockFindOne).toHaveBeenCalledWith({ id: '1' }, txClient);

            mockFindOne.mockRestore();
        });

        it('should use tx client for db.query when relations requested', async () => {
            const mockResult = { id: '1', name: 'Premium', eventLevel: { id: 'l1' } };
            const txFindFirst = vi.fn().mockResolvedValue(mockResult);
            const txClient = {
                query: {
                    sponsorshipPackages: {
                        findFirst: txFindFirst
                    }
                }
            } as unknown as DrizzleClient;

            const result = await model.findWithRelations(
                { id: '1' },
                { eventLevel: true },
                txClient
            );

            expect(result).toEqual(mockResult);
            expect(getDb).not.toHaveBeenCalled();
            expect(txFindFirst).toHaveBeenCalled();
        });

        it('should throw DbError on database failure', async () => {
            const db = {
                query: {
                    sponsorshipPackages: {
                        findFirst: vi.fn().mockRejectedValue(new Error('db fail'))
                    }
                }
            };
            getDb.mockReturnValue(db);

            await expect(
                model.findWithRelations({ id: '1' }, { eventLevel: true })
            ).rejects.toThrow(DbError);
        });
    });
});
