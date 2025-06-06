import type { PostId, UserId } from '@repo/types';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostModel } from '../../../models/post/post.model';
import { PostService } from '../../../services/post/post.service';
import { dbLogger } from '../../../utils/logger';
import { getMockPost, getMockUser } from '../../mockData';

vi.mock('../../../utils/logger', () => ({
    dbLogger: {
        info: vi.fn(),
        error: vi.fn(),
        query: vi.fn(),
        permission: vi.fn()
    }
}));

vi.mock('../../../models/post/post.model');

vi.mock('../../../utils/permission-manager', () => ({
    hasPermission: vi.fn(() => {
        throw new Error('No permission');
    })
}));

const user = getMockUser({ id: 'not-author-uuid' as UserId, role: RoleEnum.USER });
const admin = getMockUser({ role: RoleEnum.ADMIN, id: 'admin-uuid' as UserId });
const publicUser = { role: RoleEnum.GUEST };
const posts = [
    getMockPost({
        id: 'public-news-post-uuid' as PostId,
        isNews: true,
        visibility: VisibilityEnum.PUBLIC,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'private-news-post-uuid' as PostId,
        isNews: true,
        visibility: VisibilityEnum.PRIVATE,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'public-nonnews-post-uuid' as PostId,
        isNews: false,
        visibility: VisibilityEnum.PUBLIC,
        authorId: 'other-author-uuid' as UserId
    })
];

beforeEach(() => {
    vi.clearAllMocks();
});
afterEach(() => {
    // No redefinir el mock aquí
});

describe('PostService.getNews', () => {
    it('should return only public news posts for public user', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = {};
        const result = await PostService.getNews(input, publicUser);
        expect(result.posts).toEqual([
            expect.objectContaining({
                isNews: true,
                visibility: VisibilityEnum.PUBLIC
            })
        ]);
        expect(dbLogger.info).toHaveBeenCalled();
    });

    it('should return all news posts for admin', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = {};
        const result = await PostService.getNews(input, admin);
        expect(result.posts).toEqual([
            expect.objectContaining({
                isNews: true,
                visibility: VisibilityEnum.PUBLIC
            }),
            expect.objectContaining({
                isNews: true,
                visibility: VisibilityEnum.PRIVATE
            })
        ]);
        expect(dbLogger.info).toHaveBeenCalled();
    });

    it('should return only public news posts for user without permission', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = {};
        const result = await PostService.getNews(input, user);
        expect(result.posts).toHaveLength(1);
        const post = result.posts[0];
        expect(post).toBeDefined();
        if (post) {
            expect(post.id).toBe('public-news-post-uuid');
            expect(post.visibility).toBe(VisibilityEnum.PUBLIC);
        }
        expect(dbLogger.info).toHaveBeenCalled();
    });

    it('should throw and log if input is invalid', async () => {
        const input = { foo: 'bar' };
        await expect(PostService.getNews(input, user)).rejects.toThrow();
        expect(dbLogger.info).toHaveBeenCalledTimes(1);
    });
});
