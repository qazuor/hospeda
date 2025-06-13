import { PostModel } from '@repo/db';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockPost, getMockPostId, getMockPublicUser, getMockUser } from '../factories';

const mockPosts = [
    getMockPost({ id: getMockPostId('post-1'), visibility: VisibilityEnum.PUBLIC, title: 'A' }),
    getMockPost({ id: getMockPostId('post-2'), visibility: VisibilityEnum.PRIVATE, title: 'B' }),
    getMockPost({ id: getMockPostId('post-3'), visibility: VisibilityEnum.PUBLIC, title: 'C' }),
    getMockPost({ id: getMockPostId('post-4'), visibility: VisibilityEnum.DRAFT, title: 'D' })
];

const admin = getMockUser({ role: RoleEnum.ADMIN });
const publicUser = getMockPublicUser();

// Arrange: reset mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
});

describe('PostService.list', () => {
    it('returns only PUBLIC posts for public user', async () => {
        (PostModel.list as unknown as Mock).mockResolvedValue(
            mockPosts.filter((p) => p.visibility === VisibilityEnum.PUBLIC)
        );
        const result = await PostService.list({ limit: 10, offset: 0 }, publicUser);
        expect(result.posts.every((p) => p.visibility === VisibilityEnum.PUBLIC)).toBe(true);
        expect(result.posts.length).toBe(2);
    });

    it('returns all posts for admin', async () => {
        (PostModel.list as unknown as Mock).mockResolvedValue(mockPosts);
        const result = await PostService.list({ limit: 10, offset: 0 }, admin);
        expect(result.posts.length).toBe(4);
    });

    it('respects pagination (limit/offset)', async () => {
        (PostModel.list as unknown as Mock).mockResolvedValue([mockPosts[1], mockPosts[2]]);
        const result = await PostService.list({ limit: 2, offset: 1 }, admin);
        expect(result.posts).toHaveLength(2);
        if (result.posts?.length && result.posts.length > 0) {
            expect(result.posts[0]?.id).toBe(getMockPostId('post-2'));
        }
    });

    it('filters by title', async () => {
        (PostModel.list as unknown as Mock).mockResolvedValue([mockPosts[0]]);
        const result = await PostService.list({ limit: 10, offset: 0, title: 'A' }, admin);
        expect(result.posts).toHaveLength(1);
        if (result.posts?.length && result.posts.length > 0) {
            expect(result.posts[0]?.title).toBe('A');
        }
    });

    it('returns empty array if no posts match', async () => {
        (PostModel.list as unknown as Mock).mockResolvedValue([]);
        const result = await PostService.list({ limit: 10, offset: 0, title: 'ZZZ' }, admin);
        expect(result.posts.length).toBe(0);
    });

    it('returns only PUBLIC posts for user with GUEST role', async () => {
        const guest = getMockUser({ role: RoleEnum.GUEST });
        (PostModel.list as unknown as Mock).mockResolvedValue(
            mockPosts.filter((p) => p.visibility === VisibilityEnum.PUBLIC)
        );
        const result = await PostService.list({ limit: 10, offset: 0 }, guest);
        expect(result.posts.every((p) => p.visibility === VisibilityEnum.PUBLIC)).toBe(true);
    });

    it('orders posts by title asc', async () => {
        (PostModel.list as unknown as Mock).mockResolvedValue([mockPosts[0], mockPosts[2]]);
        const result = await PostService.list(
            { limit: 10, offset: 0, order: 'asc', orderBy: 'title' },
            admin
        );
        expect(result.posts).toHaveLength(2);
        if (Array.isArray(result.posts) && result.posts[0] && result.posts[1]) {
            expect(result.posts[0].title <= result.posts[1].title).toBe(true);
        }
    });

    it('orders posts by title desc', async () => {
        (PostModel.list as unknown as Mock).mockResolvedValue([mockPosts[2], mockPosts[0]]);
        const result = await PostService.list(
            { limit: 10, offset: 0, order: 'desc', orderBy: 'title' },
            admin
        );
        expect(result.posts).toHaveLength(2);
        if (Array.isArray(result.posts) && result.posts[0] && result.posts[1]) {
            expect(result.posts[0].title >= result.posts[1].title).toBe(true);
        }
    });
});
