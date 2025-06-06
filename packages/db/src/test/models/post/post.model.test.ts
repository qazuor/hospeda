import type { NewPostInputType, UpdatePostInputType } from '@repo/types/entities/post/post.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { PostModel } from '../../../../src/models/post/post.model';
import { dbLogger } from '../../../../src/utils/logger';
import { mockPost } from '../../mockData';

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

describe('PostModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns post if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...mockPost }]);
            const res = await PostModel.getById('post-uuid');
            expect(res).toEqual(mockPost);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const res = await PostModel.getById('not-exist');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostModel.getById('err')).rejects.toThrow(
                'Failed to get post by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getBySlug', () => {
        it('returns post if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...mockPost }]);
            const res = await PostModel.getBySlug('post-slug');
            expect(res).toEqual(mockPost);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const res = await PostModel.getBySlug('not-exist');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostModel.getBySlug('err')).rejects.toThrow(
                'Failed to get post by slug: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByCategory', () => {
        it('returns posts by category', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...mockPost }]);
            const res = await PostModel.getByCategory('GENERAL');
            expect(res).toEqual([mockPost]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await PostModel.getByCategory('NOPE');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostModel.getByCategory('err')).rejects.toThrow(
                'Failed to get posts by category: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByAuthor', () => {
        it('returns posts by author', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...mockPost }]);
            const res = await PostModel.getByAuthor('user-uuid');
            expect(res).toEqual([mockPost]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await PostModel.getByAuthor('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostModel.getByAuthor('err')).rejects.toThrow(
                'Failed to get posts by author: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created post', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...mockPost }]);
            const input: NewPostInputType = {
                slug: mockPost.slug,
                category: mockPost.category,
                title: mockPost.title,
                summary: mockPost.summary,
                content: mockPost.content,
                media: mockPost.media,
                authorId: mockPost.authorId,
                visibility: mockPost.visibility,
                lifecycleState: mockPost.lifecycleState,
                moderationState: mockPost.moderationState
            };
            const res = await PostModel.create(input);
            expect(res).toEqual(mockPost);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewPostInputType = {
                slug: mockPost.slug,
                category: mockPost.category,
                title: mockPost.title,
                summary: mockPost.summary,
                content: mockPost.content,
                media: mockPost.media,
                authorId: mockPost.authorId,
                visibility: mockPost.visibility,
                lifecycleState: mockPost.lifecycleState,
                moderationState: mockPost.moderationState
            };
            await expect(PostModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewPostInputType = {
                slug: mockPost.slug,
                category: mockPost.category,
                title: mockPost.title,
                summary: mockPost.summary,
                content: mockPost.content,
                media: mockPost.media,
                authorId: mockPost.authorId,
                visibility: mockPost.visibility,
                lifecycleState: mockPost.lifecycleState,
                moderationState: mockPost.moderationState
            };
            await expect(PostModel.create(input)).rejects.toThrow('Failed to create post: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated post', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...mockPost, title: 'Nuevo' }]);
            const input: UpdatePostInputType = { title: 'Nuevo' };
            const res = await PostModel.update('post-uuid', input);
            expect(res).toEqual({ ...mockPost, title: 'Nuevo' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdatePostInputType = { title: 'Nuevo' };
            const res = await PostModel.update('not-exist', input);
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdatePostInputType = { title: 'Nuevo' };
            await expect(PostModel.update('err', input)).rejects.toThrow(
                'Failed to update post: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns deleted id', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'post-uuid' }]);
            const res = await PostModel.delete('post-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'post-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await PostModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete post: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await PostModel.hardDelete('post-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await PostModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete post: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns paginated posts', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...mockPost }]);
            const res = await PostModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([mockPost]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await PostModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list posts: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns found posts', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...mockPost }]);
            const res = await PostModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([mockPost]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await PostModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search posts: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{ count: 5 }]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await PostModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(5);
        });
        it('returns 0 if not found', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{}]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await PostModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(PostModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count posts: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
