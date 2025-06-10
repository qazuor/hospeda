import type { PostId } from '@repo/types';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostModel } from '../../../../src/models/post/post.model';
import { PostService } from '../../../../src/services/post/post.service';
import { getMockPost, getMockPublicUser, getMockUser } from '../mockData';

vi.mock('../../../../src/models/post/post.model');

const mockPosts = [
    getMockPost({ id: 'post-1' as PostId, visibility: VisibilityEnum.PUBLIC, title: 'A' }),
    getMockPost({ id: 'post-2' as PostId, visibility: VisibilityEnum.PRIVATE, title: 'B' }),
    getMockPost({ id: 'post-3' as PostId, visibility: VisibilityEnum.PUBLIC, title: 'C' }),
    getMockPost({ id: 'post-4' as PostId, visibility: VisibilityEnum.DRAFT, title: 'D' })
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
            expect(result.posts[0]?.id).toBe('post-2');
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
