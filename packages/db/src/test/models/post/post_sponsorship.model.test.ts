import { LifecycleStatusEnum, PriceCurrencyEnum } from '@repo/types';
import type { PostId, PostSponsorId, PostSponsorshipId, UserId } from '@repo/types/common/id.types';
import type {
    NewPostSponsorshipInputType,
    PostSponsorshipType,
    UpdatePostSponsorshipInputType
} from '@repo/types/entities/post/post.sponsorship.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { PostSponsorshipModel } from '../../../../src/models/post/post_sponsorship.model';
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

const baseSponsorship: PostSponsorshipType = {
    id: 'sponsorship-uuid' as PostSponsorshipId,
    sponsorId: 'sponsor-uuid' as PostSponsorId,
    postId: 'post-uuid' as PostId,
    message: 'Mensaje',
    description: 'Descripción',
    paid: { price: 100, currency: PriceCurrencyEnum.ARS },
    paidAt: new Date(),
    fromDate: new Date(),
    toDate: new Date(),
    isHighlighted: true,
    adminInfo: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE
};

describe('PostSponsorshipModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns sponsorship if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([baseSponsorship]);
            const res = await PostSponsorshipModel.getById('sponsorship-uuid');
            expect(res).toEqual(baseSponsorship);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const res = await PostSponsorshipModel.getById('not-exist');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorshipModel.getById('err')).rejects.toThrow(
                'Failed to get post sponsorship by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getBySponsorId', () => {
        it('returns sponsorships by sponsorId', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([baseSponsorship]);
            const res = await PostSponsorshipModel.getBySponsorId('sponsor-uuid');
            expect(res).toEqual([baseSponsorship]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await PostSponsorshipModel.getBySponsorId('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorshipModel.getBySponsorId('err')).rejects.toThrow(
                'Failed to get post sponsorships by sponsorId: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByPostId', () => {
        it('returns sponsorships by postId', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([baseSponsorship]);
            const res = await PostSponsorshipModel.getByPostId('post-uuid');
            expect(res).toEqual([baseSponsorship]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await PostSponsorshipModel.getByPostId('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorshipModel.getByPostId('err')).rejects.toThrow(
                'Failed to get post sponsorships by postId: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created sponsorship', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([baseSponsorship]);
            const input: NewPostSponsorshipInputType = {
                sponsorId: baseSponsorship.sponsorId,
                postId: baseSponsorship.postId,
                description: baseSponsorship.description,
                paid: baseSponsorship.paid
            } as NewPostSponsorshipInputType;
            const res = await PostSponsorshipModel.create(input);
            expect(res).toEqual(baseSponsorship);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewPostSponsorshipInputType = {
                sponsorId: baseSponsorship.sponsorId,
                postId: baseSponsorship.postId,
                description: baseSponsorship.description,
                paid: baseSponsorship.paid
            } as NewPostSponsorshipInputType;
            await expect(PostSponsorshipModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewPostSponsorshipInputType = {
                sponsorId: baseSponsorship.sponsorId,
                postId: baseSponsorship.postId,
                description: baseSponsorship.description,
                paid: baseSponsorship.paid
            } as NewPostSponsorshipInputType;
            await expect(PostSponsorshipModel.create(input)).rejects.toThrow(
                'Failed to create post sponsorship: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated sponsorship', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseSponsorship, description: 'Nuevo' }]);
            const input: UpdatePostSponsorshipInputType = { description: 'Nuevo' };
            const res = await PostSponsorshipModel.update('sponsorship-uuid', input);
            expect(res).toEqual({ ...baseSponsorship, description: 'Nuevo' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdatePostSponsorshipInputType = { description: 'Nuevo' };
            const res = await PostSponsorshipModel.update('not-exist', input);
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdatePostSponsorshipInputType = { description: 'Nuevo' };
            await expect(PostSponsorshipModel.update('err', input)).rejects.toThrow(
                'Failed to update post sponsorship: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns deleted id', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'sponsorship-uuid' }]);
            const res = await PostSponsorshipModel.delete('sponsorship-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'sponsorship-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await PostSponsorshipModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorshipModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete post sponsorship: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await PostSponsorshipModel.hardDelete('sponsorship-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await PostSponsorshipModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorshipModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete post sponsorship: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns paginated sponsorships', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([baseSponsorship]);
            const res = await PostSponsorshipModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([baseSponsorship]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await PostSponsorshipModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorshipModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list post sponsorships: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns found sponsorships', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([baseSponsorship]);
            const res = await PostSponsorshipModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([baseSponsorship]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await PostSponsorshipModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorshipModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search post sponsorships: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{ count: 5 }]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await PostSponsorshipModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(5);
        });
        it('returns 0 if not found', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{}]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await PostSponsorshipModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorshipModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count post sponsorships: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
