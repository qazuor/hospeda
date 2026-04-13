import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { SponsorshipLevelModel } from '../../src/models/sponsorship/sponsorshipLevel.model';
import type { DrizzleClient } from '../../src/types';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('SponsorshipLevelModel', () => {
    let model: SponsorshipLevelModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let _logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new SponsorshipLevelModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        _logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(SponsorshipLevelModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('sponsorshipLevels');
        });
    });

    describe('findBySlug', () => {
        it('should return a sponsorship level when found', async () => {
            const mockLevel = { id: '1', slug: 'gold', name: 'Gold Level' };
            const db = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([mockLevel])
                        })
                    })
                })
            };
            getDb.mockReturnValue(db);

            const result = await model.findBySlug('gold');

            expect(result).toEqual(mockLevel);
            expect(logQuery).toHaveBeenCalledWith(
                'sponsorshipLevels',
                'findBySlug',
                { slug: 'gold' },
                [mockLevel]
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
            const mockLevel = { id: '1', slug: 'gold', name: 'Gold Level' };
            const txClient = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([mockLevel])
                        })
                    })
                })
            } as unknown as DrizzleClient;

            const result = await model.findBySlug('gold', txClient);

            expect(result).toEqual(mockLevel);
            expect(getDb).not.toHaveBeenCalled();
            expect(txClient.select).toHaveBeenCalled();
        });
    });

    describe('findActiveByTargetType', () => {
        it('should delegate to findAll with correct where clause', async () => {
            const mockResult = { items: [], total: 0 };
            const mockFindAll = vi.spyOn(model, 'findAll').mockResolvedValue(mockResult);

            await model.findActiveByTargetType('accommodation');

            expect(mockFindAll).toHaveBeenCalledWith(
                { targetType: 'accommodation', isActive: true, deletedAt: null },
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

            await model.findActiveByTargetType('accommodation', txClient);

            expect(mockFindAll).toHaveBeenCalledWith(
                { targetType: 'accommodation', isActive: true, deletedAt: null },
                undefined,
                undefined,
                txClient
            );

            mockFindAll.mockRestore();
        });

        it('should throw DbError on failure', async () => {
            vi.spyOn(model, 'findAll').mockRejectedValue(new Error('db fail'));

            await expect(model.findActiveByTargetType('accommodation')).rejects.toThrow(DbError);
        });
    });

    describe('findWithRelations', () => {
        it('should return result with relations when relations requested', async () => {
            const mockResult = { id: '1', name: 'Gold', createdBy: { id: 'u1' } };
            const db = {
                query: {
                    sponsorshipLevels: {
                        findFirst: vi.fn().mockResolvedValue(mockResult)
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findWithRelations({ id: '1' }, { createdBy: true });

            expect(result).toEqual(mockResult);
            expect(db.query.sponsorshipLevels.findFirst).toHaveBeenCalled();
        });

        it('should fall back to findOne when no relations requested', async () => {
            const mockResult = { id: '1', name: 'Gold' };
            const mockFindOne = vi.spyOn(model, 'findOne').mockResolvedValue(mockResult as never);

            const result = await model.findWithRelations({ id: '1' }, {});

            expect(result).toEqual(mockResult);
            expect(mockFindOne).toHaveBeenCalledWith({ id: '1' }, undefined);

            mockFindOne.mockRestore();
        });

        it('should pass tx to findOne when no relations requested', async () => {
            const mockResult = { id: '1', name: 'Gold' };
            const txClient = {} as unknown as DrizzleClient;
            const mockFindOne = vi.spyOn(model, 'findOne').mockResolvedValue(mockResult as never);

            await model.findWithRelations({ id: '1' }, {}, txClient);

            expect(mockFindOne).toHaveBeenCalledWith({ id: '1' }, txClient);

            mockFindOne.mockRestore();
        });

        it('should use tx client for db.query when relations requested', async () => {
            const mockResult = { id: '1', name: 'Gold', createdBy: { id: 'u1' } };
            const txFindFirst = vi.fn().mockResolvedValue(mockResult);
            const txClient = {
                query: {
                    sponsorshipLevels: {
                        findFirst: txFindFirst
                    }
                }
            } as unknown as DrizzleClient;

            const result = await model.findWithRelations(
                { id: '1' },
                { createdBy: true },
                txClient
            );

            expect(result).toEqual(mockResult);
            expect(getDb).not.toHaveBeenCalled();
            expect(txFindFirst).toHaveBeenCalled();
        });

        it('should throw DbError on database failure', async () => {
            const db = {
                query: {
                    sponsorshipLevels: {
                        findFirst: vi.fn().mockRejectedValue(new Error('db fail'))
                    }
                }
            };
            getDb.mockReturnValue(db);

            await expect(model.findWithRelations({ id: '1' }, { createdBy: true })).rejects.toThrow(
                DbError
            );
        });
    });
});
