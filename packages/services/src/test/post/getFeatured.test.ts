import { PostModel } from '@repo/db';
import { VisibilityEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockPost, getMockPostId } from '../factories/postFactory';
import {
    getMockAdminUser,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../factories/userFactory';
import { expectInfoLog } from '../utils/log-assertions';

vi.mock('../../utils/permission-manager', () => ({
    hasPermission: vi.fn(() => {
        throw new Error('No permission');
    })
}));

const user = getMockUser({ id: getMockUserId('not-author-uuid') });
const admin = getMockAdminUser({ id: getMockUserId('admin-uuid') });
const publicUser = getMockPublicUser();
const posts = [
    getMockPost({
        id: getMockPostId('public-featured-post-uuid'),
        isFeatured: true,
        visibility: VisibilityEnum.PUBLIC,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('private-featured-post-uuid'),
        isFeatured: true,
        visibility: VisibilityEnum.PRIVATE,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('public-nonfeatured-post-uuid'),
        isFeatured: false,
        visibility: VisibilityEnum.PUBLIC,
        authorId: getMockUserId('other-author-uuid')
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
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'GUEST' }), input: {} },
            'getFeatured:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getFeatured:end'
        );
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
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'ADMIN' }), input: {} },
            'getFeatured:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getFeatured:end'
        );
    });

    it('should return only public featured posts for user without permission', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = {};
        const result = await PostService.getFeatured(input, user);
        expect(result.posts).toHaveLength(1);
        const post = result.posts[0];
        expect(post).toBeDefined();
        if (post) {
            expect(post.id).toBe(getMockPostId('public-featured-post-uuid'));
            expect(post.visibility).toBe(VisibilityEnum.PUBLIC);
        }
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: {} },
            'getFeatured:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getFeatured:end'
        );
    });

    it('should throw and log if input is invalid', async () => {
        const input = { foo: 'bar' };
        await expect(PostService.getFeatured(input, user)).rejects.toThrow();
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: { foo: 'bar' } },
            'getFeatured:start'
        );
    });
});
