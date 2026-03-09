import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AccommodationReviewModel } from '../../src/models/accommodation/accommodationReview.model';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

vi.mock('../../src/utils/drizzle-helpers', () => ({
    buildWhereClause: vi.fn(() => undefined)
}));

describe('AccommodationReviewModel', () => {
    let model: AccommodationReviewModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let _logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AccommodationReviewModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        _logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(AccommodationReviewModel);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            const tableName = (model as unknown as { getTableName(): string }).getTableName();
            expect(tableName).toBe('accommodationReviews');
        });
    });

    describe('findAllWithUser', () => {
        it('should return items with user relations without pagination', async () => {
            const mockItems = [{ id: '1', rating: 5, user: { id: 'u1', email: 'test@test.com' } }];
            const db = {
                query: {
                    accommodationReviews: {
                        findMany: vi.fn().mockResolvedValue(mockItems)
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findAllWithUser({});

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(db.query.accommodationReviews.findMany).toHaveBeenCalledWith({
                where: undefined,
                with: { user: true, accommodation: true }
            });
            expect(logQuery).toHaveBeenCalledWith(
                'accommodationReviews',
                'findAllWithUser',
                expect.objectContaining({ where: {} }),
                expect.objectContaining({ items: mockItems, total: 1 })
            );
        });

        it('should return paginated items with user relations', async () => {
            const mockItems = [{ id: '1', rating: 5, user: { id: 'u1', email: 'test@test.com' } }];
            const mockCount = vi.spyOn(model, 'count').mockResolvedValue(10);
            const db = {
                query: {
                    accommodationReviews: {
                        findMany: vi.fn().mockResolvedValue(mockItems)
                    }
                }
            };
            getDb.mockReturnValue(db);

            const result = await model.findAllWithUser({}, { page: 2, pageSize: 5 });

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(10);
            expect(db.query.accommodationReviews.findMany).toHaveBeenCalledWith({
                where: undefined,
                with: { user: true, accommodation: true },
                limit: 5,
                offset: 5
            });

            mockCount.mockRestore();
        });

        it('should throw DbError on database failure', async () => {
            const db = {
                query: {
                    accommodationReviews: {
                        findMany: vi.fn().mockRejectedValue(new Error('db fail'))
                    }
                }
            };
            getDb.mockReturnValue(db);

            await expect(model.findAllWithUser({})).rejects.toThrow(DbError);
        });
    });
});
