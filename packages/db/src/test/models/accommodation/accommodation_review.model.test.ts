import { LifecycleStatusEnum } from '@repo/types';
import type { AccommodationId, AccommodationReviewId, UserId } from '@repo/types/common/id.types';
import type {
    AccommodationReviewType,
    NewAccommodationReviewInputType,
    UpdateAccommodationReviewInputType
} from '@repo/types/entities/accommodation/accommodation.review.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { AccommodationReviewModel } from '../../../../src/models/accommodation/accommodation_review.model';
import { dbLogger } from '../../../../src/utils/logger';

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

const baseReview: AccommodationReviewType = {
    id: 'review-uuid' as AccommodationReviewId,
    accommodationId: 'acc-uuid' as AccommodationId,
    userId: 'user-uuid' as UserId,
    title: 'Excelente estadía',
    content: 'Todo estuvo perfecto.',
    rating: {
        cleanliness: 5,
        hospitality: 5,
        services: 4,
        accuracy: 5,
        communication: 5,
        location: 4
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined
};

describe('AccommodationReviewModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns review if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseReview }]);
            const res = await AccommodationReviewModel.getById('review-uuid');
            expect(res).toEqual(baseReview);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const res = await AccommodationReviewModel.getById('not-exist');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationReviewModel.getById('err')).rejects.toThrow(
                'Failed to get accommodation review by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByAccommodationId', () => {
        it('returns reviews array', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseReview }]);
            const res = await AccommodationReviewModel.getByAccommodationId('acc-uuid');
            expect(res).toEqual([baseReview]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await AccommodationReviewModel.getByAccommodationId('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationReviewModel.getByAccommodationId('err')).rejects.toThrow(
                'Failed to get accommodation reviews by accommodationId: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByUserId', () => {
        it('returns reviews array', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseReview }]);
            const res = await AccommodationReviewModel.getByUserId('user-uuid');
            expect(res).toEqual([baseReview]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await AccommodationReviewModel.getByUserId('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationReviewModel.getByUserId('err')).rejects.toThrow(
                'Failed to get accommodation reviews by userId: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created review', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseReview }]);
            const input: NewAccommodationReviewInputType = {
                accommodationId: baseReview.accommodationId,
                userId: baseReview.userId,
                title: baseReview.title,
                content: baseReview.content,
                rating: baseReview.rating,
                adminInfo: baseReview.adminInfo,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            const res = await AccommodationReviewModel.create(input);
            expect(res).toEqual(baseReview);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewAccommodationReviewInputType = {
                accommodationId: baseReview.accommodationId,
                userId: baseReview.userId,
                title: baseReview.title,
                content: baseReview.content,
                rating: baseReview.rating,
                adminInfo: baseReview.adminInfo,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            await expect(AccommodationReviewModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewAccommodationReviewInputType = {
                accommodationId: baseReview.accommodationId,
                userId: baseReview.userId,
                title: baseReview.title,
                content: baseReview.content,
                rating: baseReview.rating,
                adminInfo: baseReview.adminInfo,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            await expect(AccommodationReviewModel.create(input)).rejects.toThrow(
                'Failed to create accommodation review: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated review', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseReview, title: 'Nueva reseña' }]);
            const input: UpdateAccommodationReviewInputType = { title: 'Nueva reseña' };
            const res = await AccommodationReviewModel.update('review-uuid', input);
            expect(res).toEqual({ ...baseReview, title: 'Nueva reseña' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdateAccommodationReviewInputType = { title: 'Nueva reseña' };
            const res = await AccommodationReviewModel.update('not-exist', input);
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdateAccommodationReviewInputType = { title: 'Nueva reseña' };
            await expect(AccommodationReviewModel.update('err', input)).rejects.toThrow(
                'Failed to update accommodation review: fail'
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
            const res = await AccommodationReviewModel.delete('review-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'review-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await AccommodationReviewModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationReviewModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete accommodation review: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await AccommodationReviewModel.hardDelete('review-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await AccommodationReviewModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationReviewModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete accommodation review: fail'
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
            mockDb.offset.mockReturnValueOnce([{ ...baseReview }]);
            const res = await AccommodationReviewModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([baseReview]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationReviewModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list accommodation reviews: fail'
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
            mockDb.offset.mockReturnValueOnce([{ ...baseReview }]);
            const res = await AccommodationReviewModel.search({
                limit: 10,
                offset: 0,
                query: 'perfecto'
            });
            expect(res).toEqual([baseReview]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                AccommodationReviewModel.search({ limit: 10, offset: 0, query: 'fail' })
            ).rejects.toThrow('Failed to search accommodation reviews: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ count: 3 }]);
            const res = await AccommodationReviewModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(3);
        });
        it('returns 0 if no result', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{}]);
            const res = await AccommodationReviewModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationReviewModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count accommodation reviews: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
