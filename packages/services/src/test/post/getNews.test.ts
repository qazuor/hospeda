import { PostModel } from '@repo/db';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import {
    getMockAdminUser,
    getMockPost,
    getMockPostId,
    getMockUser,
    getMockUserId
} from '../factories';
import { expectInfoLog } from '../utils/log-assertions';

vi.mock('../../utils/permission-manager', () => ({
    hasPermission: vi.fn(() => {
        throw new Error('No permission');
    })
}));

const user = getMockUser({ id: getMockUserId('not-author-uuid') });
const admin = getMockAdminUser();
const publicUser = { role: RoleEnum.GUEST };
const posts = [
    getMockPost({
        id: getMockPostId('public-news-post-001'),
        isNews: true,
        visibility: VisibilityEnum.PUBLIC,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('private-news-post-uuid'),
        isNews: true,
        visibility: VisibilityEnum.PRIVATE,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('public-nonnews-post-uuid'),
        isNews: false,
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
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'GUEST' }), input: {} },
            'getNews:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getNews:end'
        );
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
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'ADMIN' }), input: {} },
            'getNews:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getNews:end'
        );
    });

    it('should return only public news posts for user without permission', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = {};
        const result = await PostService.getNews(input, user);
        expect(result.posts).toHaveLength(1);
        const post = result.posts[0];
        expect(post).toBeDefined();
        if (post) {
            expect(post.id).toBe(getMockPostId('public-news-post-001'));
            expect(post.visibility).toBe(VisibilityEnum.PUBLIC);
        }
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: {} },
            'getNews:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getNews:end'
        );
    });

    it('should throw and log if input is invalid', async () => {
        const input = { foo: 'bar' };
        await expect(PostService.getNews(input, user)).rejects.toThrow();
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: { foo: 'bar' } },
            'getNews:start'
        );
    });
});
