import { ClientTypeEnum, LifecycleStatusEnum } from '@repo/types';
import type { PostSponsorId, UserId } from '@repo/types/common/id.types';
import type {
    NewPostSponsorInputType,
    PostSponsorType,
    UpdatePostSponsorInputType
} from '@repo/types/entities/post/post.sponsor.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { PostSponsorModel } from '../../../../src/models/post/post_sponsor.model';
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

const baseSponsor: PostSponsorType = {
    id: 'sponsor-uuid' as PostSponsorId,
    name: 'Sponsor Name',
    type: ClientTypeEnum.POST_SPONSOR,
    description: 'Sponsor description',
    logo: undefined,
    contact: undefined,
    social: undefined,
    adminInfo: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE
};

describe('PostSponsorModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns sponsor if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([baseSponsor]);
            const res = await PostSponsorModel.getById('sponsor-uuid');
            expect(res).toEqual(baseSponsor);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const res = await PostSponsorModel.getById('not-exist');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorModel.getById('err')).rejects.toThrow(
                'Failed to get post sponsor by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByName', () => {
        it('returns sponsors by name', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([baseSponsor]);
            const res = await PostSponsorModel.getByName('Sponsor');
            expect(res).toEqual([baseSponsor]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await PostSponsorModel.getByName('Nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorModel.getByName('err')).rejects.toThrow(
                'Failed to get post sponsors by name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created sponsor', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([baseSponsor]);
            const input: NewPostSponsorInputType = {
                name: baseSponsor.name,
                type: baseSponsor.type,
                description: baseSponsor.description
            } as NewPostSponsorInputType;
            const res = await PostSponsorModel.create(input);
            expect(res).toEqual(baseSponsor);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewPostSponsorInputType = {
                name: baseSponsor.name,
                type: baseSponsor.type,
                description: baseSponsor.description
            } as NewPostSponsorInputType;
            await expect(PostSponsorModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewPostSponsorInputType = {
                name: baseSponsor.name,
                type: baseSponsor.type,
                description: baseSponsor.description
            } as NewPostSponsorInputType;
            await expect(PostSponsorModel.create(input)).rejects.toThrow(
                'Failed to create post sponsor: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated sponsor', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseSponsor, name: 'Nuevo' }]);
            const input: UpdatePostSponsorInputType = { name: 'Nuevo' };
            const res = await PostSponsorModel.update('sponsor-uuid', input);
            expect(res).toEqual({ ...baseSponsor, name: 'Nuevo' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdatePostSponsorInputType = { name: 'Nuevo' };
            const res = await PostSponsorModel.update('not-exist', input);
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdatePostSponsorInputType = { name: 'Nuevo' };
            await expect(PostSponsorModel.update('err', input)).rejects.toThrow(
                'Failed to update post sponsor: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns deleted id', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'sponsor-uuid' }]);
            const res = await PostSponsorModel.delete('sponsor-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'sponsor-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await PostSponsorModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete post sponsor: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await PostSponsorModel.hardDelete('sponsor-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await PostSponsorModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete post sponsor: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns paginated sponsors', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([baseSponsor]);
            const res = await PostSponsorModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([baseSponsor]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await PostSponsorModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list post sponsors: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns found sponsors', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([baseSponsor]);
            const res = await PostSponsorModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([baseSponsor]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await PostSponsorModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search post sponsors: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{ count: 5 }]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await PostSponsorModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(5);
        });
        it('returns 0 if not found', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{}]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await PostSponsorModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostSponsorModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count post sponsors: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
