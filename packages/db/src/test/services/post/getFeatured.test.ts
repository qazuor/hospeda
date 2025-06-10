import type { PostId, UserId } from '@repo/types';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostModel } from '../../../models/post/post.model';
import { PostService } from '../../../services/post/post.service';
import { getMockPost, getMockUser } from '../mockData';

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
        id: 'public-featured-post-uuid' as PostId,
        isFeatured: true,
        visibility: VisibilityEnum.PUBLIC,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'private-featured-post-uuid' as PostId,
        isFeatured: true,
        visibility: VisibilityEnum.PRIVATE,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'public-nonfeatured-post-uuid' as PostId,
        isFeatured: false,
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

describe('PostService.getFeatured', () => {
    it('should return only public featured posts for public user', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = {};
        const result = await PostService.getFeatured(input, publicUser);
        expect(result.posts).toEqual([
            expect.objectContaining({
                isFeatured: true,
                visibility: VisibilityEnum.PUBLIC
            })
        ]);
        expect(mockServiceLogger.info).toHaveBeenCalled();
    });

    it('should return all featured posts for admin', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = {};
        const result = await PostService.getFeatured(input, admin);
        expect(result.posts).toEqual([
            expect.objectContaining({
                isFeatured: true,
                visibility: VisibilityEnum.PUBLIC
            }),
            expect.objectContaining({
                isFeatured: true,
                visibility: VisibilityEnum.PRIVATE
            })
        ]);
        expect(mockServiceLogger.info).toHaveBeenCalled();
    });

    it('should return only public featured posts for user without permission', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = {};
        const result = await PostService.getFeatured(input, user);
        expect(result.posts).toHaveLength(1);
        const post = result.posts[0];
        expect(post).toBeDefined();
        if (post) {
            expect(post.id).toBe('public-featured-post-uuid');
            expect(post.visibility).toBe(VisibilityEnum.PUBLIC);
        }
        expect(mockServiceLogger.info).toHaveBeenCalled();
    });

    it('should throw and log if input is invalid', async () => {
        const input = { foo: 'bar' };
        await expect(PostService.getFeatured(input, user)).rejects.toThrow();
        expect(mockServiceLogger.info).toHaveBeenCalledTimes(1);
    });
});
