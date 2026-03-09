import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { SponsorshipLevelModel } from '../../src/models/sponsorship/sponsorshipLevel.model';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

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
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        _logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
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
            expect(mockFindOne).toHaveBeenCalledWith({ id: '1' });

            mockFindOne.mockRestore();
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
