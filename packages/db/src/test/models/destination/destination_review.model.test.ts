import type {
    NewDestinationReviewInputType,
    UpdateDestinationReviewInputType
} from '@repo/types/entities/destination/destination.review.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { DestinationReviewModel } from '../../../../src/models/destination/destination_review.model';
import { dbLogger } from '../../../../src/utils/logger';
import { mockDestinationReview } from '../../mockData';

vi.mock('../../../../src/utils/logger');
vi.mock('../../../../src/client');

const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    query: {}
};
(getDb as unknown as Mock).mockReturnValue(mockDb);

describe('DestinationReviewModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns review if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...mockDestinationReview }]);
            const res = await DestinationReviewModel.getById('review-uuid');
            expect(res).toEqual(mockDestinationReview);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const res = await DestinationReviewModel.getById('not-exist');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(DestinationReviewModel.getById('err')).rejects.toThrow(
                'Failed to get destination review by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByDestinationId', () => {
        it('returns reviews array', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...mockDestinationReview }]);
            const res = await DestinationReviewModel.getByDestinationId('dest-uuid');
            expect(res).toEqual([mockDestinationReview]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await DestinationReviewModel.getByDestinationId('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(DestinationReviewModel.getByDestinationId('err')).rejects.toThrow(
                'Failed to get destination reviews by destinationId: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByUserId', () => {
        it('returns reviews array', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...mockDestinationReview }]);
            const res = await DestinationReviewModel.getByUserId('user-uuid');
            expect(res).toEqual([mockDestinationReview]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await DestinationReviewModel.getByUserId('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(DestinationReviewModel.getByUserId('err')).rejects.toThrow(
                'Failed to get destination reviews by userId: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created review', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...mockDestinationReview }]);
            const input: NewDestinationReviewInputType = {
                destinationId: mockDestinationReview.destinationId,
                userId: mockDestinationReview.userId,
                title: mockDestinationReview.title,
                content: mockDestinationReview.content,
                rating: mockDestinationReview.rating
            };
            const res = await DestinationReviewModel.create(input);
            expect(res).toEqual(mockDestinationReview);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewDestinationReviewInputType = {
                destinationId: mockDestinationReview.destinationId,
                userId: mockDestinationReview.userId,
                title: mockDestinationReview.title,
                content: mockDestinationReview.content,
                rating: mockDestinationReview.rating
            };
            await expect(DestinationReviewModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewDestinationReviewInputType = {
                destinationId: mockDestinationReview.destinationId,
                userId: mockDestinationReview.userId,
                title: mockDestinationReview.title,
                content: mockDestinationReview.content,
                rating: mockDestinationReview.rating
            };
            await expect(DestinationReviewModel.create(input)).rejects.toThrow(
                'Failed to create destination review: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated review', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([
                { ...mockDestinationReview, title: 'Nueva reseña' }
            ]);
            const input: UpdateDestinationReviewInputType = { title: 'Nueva reseña' };
            const res = await DestinationReviewModel.update('review-uuid', input);
            expect(res).toEqual({ ...mockDestinationReview, title: 'Nueva reseña' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdateDestinationReviewInputType = { title: 'Nueva reseña' };
            const res = await DestinationReviewModel.update('not-exist', input);
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdateDestinationReviewInputType = { title: 'Nueva reseña' };
            await expect(DestinationReviewModel.update('err', input)).rejects.toThrow(
                'Failed to update destination review: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns deleted id', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'review-uuid' }]);
            const res = await DestinationReviewModel.delete('review-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'review-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await DestinationReviewModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(DestinationReviewModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete destination review: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await DestinationReviewModel.hardDelete('review-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await DestinationReviewModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(DestinationReviewModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete destination review: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns paginated reviews', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...mockDestinationReview }]);
            const res = await DestinationReviewModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([mockDestinationReview]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(DestinationReviewModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list destination reviews: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns paginated reviews matching query', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...mockDestinationReview }]);
            const res = await DestinationReviewModel.search({
                limit: 10,
                offset: 0,
                query: 'increíble'
            });
            expect(res).toEqual([mockDestinationReview]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                DestinationReviewModel.search({ limit: 10, offset: 0, query: 'fail' })
            ).rejects.toThrow('Failed to search destination reviews: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ count: 2 }]);
            const res = await DestinationReviewModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(2);
        });
        it('returns 0 if no result', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{}]);
            const res = await DestinationReviewModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(DestinationReviewModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count destination reviews: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
