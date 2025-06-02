import { EntityTypeEnum } from '@repo/types';
import type { AccommodationId, UserBookmarkId, UserId } from '@repo/types/common/id.types';
import type {
    NewUserBookmarkInputType,
    UpdateUserBookmarkInputType,
    UserBookmarkType
} from '@repo/types/entities/user/user.bookmark.types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { UserBookmarkModel } from '../../../../src/models/user/user_bookmark.model';
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

const baseBookmark: UserBookmarkType = {
    id: 'bookmark-uuid' as UserBookmarkId,
    entityId: 'accommodation-uuid' as AccommodationId,
    entityType: EntityTypeEnum.DESTINATION,
    name: 'Mi destino favorito',
    description: 'Un destino que quiero visitar',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined
};

describe('UserBookmarkModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns bookmark if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseBookmark }]);
            const res = await UserBookmarkModel.getById('bookmark-uuid');
            expect(res).toEqual(baseBookmark);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const res = await UserBookmarkModel.getById('not-exist');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserBookmarkModel.getById('err')).rejects.toThrow(
                'Failed to get user bookmark by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByUserId', () => {
        it('returns bookmarks array', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseBookmark }]);
            const res = await UserBookmarkModel.getByUserId('user-uuid');
            expect(res).toEqual([baseBookmark]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await UserBookmarkModel.getByUserId('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserBookmarkModel.getByUserId('err')).rejects.toThrow(
                'Failed to get user bookmarks by userId: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByEntity', () => {
        it('returns bookmarks array', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseBookmark }]);
            const res = await UserBookmarkModel.getByEntity(
                'accommodation-uuid' as AccommodationId,
                EntityTypeEnum.DESTINATION
            );
            expect(res).toEqual([baseBookmark]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await UserBookmarkModel.getByEntity(
                'nope' as AccommodationId,
                EntityTypeEnum.DESTINATION
            );
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                UserBookmarkModel.getByEntity('err' as AccommodationId, EntityTypeEnum.DESTINATION)
            ).rejects.toThrow('Failed to get user bookmarks by entity: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created bookmark', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseBookmark }]);
            const input: NewUserBookmarkInputType = {
                entityId: baseBookmark.entityId,
                entityType: baseBookmark.entityType,
                name: baseBookmark.name,
                description: baseBookmark.description,
                adminInfo: baseBookmark.adminInfo,
                lifecycleState: baseBookmark.lifecycleState
            };
            const res = await UserBookmarkModel.create(input);
            expect(res).toEqual(baseBookmark);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewUserBookmarkInputType = {
                entityId: baseBookmark.entityId,
                entityType: baseBookmark.entityType,
                name: baseBookmark.name,
                description: baseBookmark.description,
                adminInfo: baseBookmark.adminInfo,
                lifecycleState: baseBookmark.lifecycleState
            };
            await expect(UserBookmarkModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewUserBookmarkInputType = {
                entityId: baseBookmark.entityId,
                entityType: baseBookmark.entityType,
                name: baseBookmark.name,
                description: baseBookmark.description,
                adminInfo: baseBookmark.adminInfo,
                lifecycleState: baseBookmark.lifecycleState
            };
            await expect(UserBookmarkModel.create(input)).rejects.toThrow(
                'Failed to create user bookmark: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated bookmark', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseBookmark, name: 'Nuevo nombre' }]);
            const input: UpdateUserBookmarkInputType = { name: 'Nuevo nombre' };
            const res = await UserBookmarkModel.update('bookmark-uuid', input);
            expect(res).toEqual({ ...baseBookmark, name: 'Nuevo nombre' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdateUserBookmarkInputType = { name: 'Nuevo nombre' };
            const res = await UserBookmarkModel.update('not-exist', input);
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdateUserBookmarkInputType = { name: 'Nuevo nombre' };
            await expect(UserBookmarkModel.update('err', input)).rejects.toThrow(
                'Failed to update user bookmark: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns deleted id', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'bookmark-uuid' }]);
            const res = await UserBookmarkModel.delete('bookmark-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'bookmark-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await UserBookmarkModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserBookmarkModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete user bookmark: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await UserBookmarkModel.hardDelete('bookmark-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await UserBookmarkModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserBookmarkModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete user bookmark: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns paginated bookmarks', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseBookmark }]);
            const res = await UserBookmarkModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([baseBookmark]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserBookmarkModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list user bookmarks: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns paginated bookmarks matching query', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseBookmark }]);
            const res = await UserBookmarkModel.search({
                limit: 10,
                offset: 0,
                query: 'favorito'
            });
            expect(res).toEqual([baseBookmark]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                UserBookmarkModel.search({ limit: 10, offset: 0, query: 'fail' })
            ).rejects.toThrow('Failed to search user bookmarks: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ count: 2 }]);
            const res = await UserBookmarkModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(2);
        });
        it('returns 0 if no result', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{}]);
            const res = await UserBookmarkModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(UserBookmarkModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count user bookmarks: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
