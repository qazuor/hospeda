import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AccommodationReviewModel } from '../../src/models/accommodation/accommodationReview.model';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

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
            expect(db.query.accommodationReviews.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: undefined,
                    with: { user: true, accommodation: true },
                    orderBy: expect.any(Function)
                })
            );
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
            expect(db.query.accommodationReviews.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: undefined,
                    with: { user: true, accommodation: true },
                    limit: 5,
                    offset: 5,
                    orderBy: expect.any(Function)
                })
            );

            mockCount.mockRestore();
        });

        it('orders paginated and unpaginated results by createdAt and id descending', async () => {
            const findMany = vi.fn().mockResolvedValue([]);
            getDb.mockReturnValue({ query: { accommodationReviews: { findMany } } });
            vi.spyOn(model, 'count').mockResolvedValue(0);
            await model.findAllWithUser({});
            await model.findAllWithUser({}, { page: 1, pageSize: 2 });

            for (const [args] of findMany.mock.calls) {
                const orderBy = (
                    args as { orderBy: (columns: unknown, helpers: unknown) => unknown[] }
                ).orderBy;
                expect(
                    orderBy(
                        { createdAt: 'c', id: 'i' },
                        { desc: (value: unknown) => ({ desc: value }) }
                    )
                ).toEqual([{ desc: 'c' }, { desc: 'i' }]);
            }
        });

        it('applies additional SQL conditions to relational items and count', async () => {
            const condition = sql`accommodation_reviews.id IS NOT NULL`;
            const findMany = vi.fn().mockResolvedValue([{ id: '1' }]);
            const db = { query: { accommodationReviews: { findMany } } };
            getDb.mockReturnValue(db);
            const count = vi.spyOn(model, 'count').mockResolvedValue(1);

            await model.findAllWithUser({}, { page: 1, pageSize: 10 }, undefined, [condition]);

            const findManyArgs = findMany.mock.calls[0]?.[0] as { where: unknown };
            expect((findManyArgs.where as { queryChunks: unknown[] }).queryChunks).toContain(
                condition
            );
            expect(count).toHaveBeenCalledWith(
                {},
                { tx: undefined, additionalConditions: [condition] }
            );
            count.mockRestore();
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
