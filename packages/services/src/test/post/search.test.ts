import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { LifecycleStatusEnum, PostCategoryEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockPost, getMockPublicUser, getMockUser } from '../mockData';

const mockPosts = [
    getMockPost({
        id: 'post-1' as PostId,
        visibility: VisibilityEnum.PUBLIC,
        title: 'A',
        category: PostCategoryEnum.GENERAL,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    }),
    getMockPost({
        id: 'post-2' as PostId,
        visibility: VisibilityEnum.PRIVATE,
        title: 'B',
        category: PostCategoryEnum.EVENTS,
        lifecycleState: LifecycleStatusEnum.ARCHIVED
    }),
    getMockPost({
        id: 'post-3' as PostId,
        visibility: VisibilityEnum.PUBLIC,
        title: 'C',
        category: PostCategoryEnum.GENERAL,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    }),
    getMockPost({
        id: 'post-4' as PostId,
        visibility: VisibilityEnum.DRAFT,
        title: 'D',
        category: PostCategoryEnum.CULTURE,
        lifecycleState: LifecycleStatusEnum.INACTIVE
    })
];

const admin = getMockUser({ role: RoleEnum.ADMIN });
const publicUser = getMockPublicUser();

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PostService.search', () => {
    it('returns only PUBLIC posts for public user', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue(
            mockPosts.filter((p) => p.visibility === VisibilityEnum.PUBLIC)
        );
        (PostModel.count as unknown as Mock).mockResolvedValue(2);
        const result = await PostService.search({ limit: 10, offset: 0 }, publicUser);
        expect(result.posts.every((p) => p.visibility === VisibilityEnum.PUBLIC)).toBe(true);
        expect(result.total).toBe(2);
    });

    it('returns all posts for admin', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue(mockPosts);
        (PostModel.count as unknown as Mock).mockResolvedValue(4);
        const result = await PostService.search({ limit: 10, offset: 0 }, admin);
        expect(result.posts.length).toBe(4);
        expect(result.total).toBe(4);
    });

    it('filters by category (enum)', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue([mockPosts[1]]);
        (PostModel.count as unknown as Mock).mockResolvedValue(1);
        const result = await PostService.search(
            { category: PostCategoryEnum.EVENTS, limit: 10, offset: 0 },
            admin
        );
        expect(result.posts.length).toBe(1);
        expect(result.posts[0]?.category).toBe(PostCategoryEnum.EVENTS);
    });

    it('filters by lifecycle (enum)', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue([mockPosts[1]]);
        (PostModel.count as unknown as Mock).mockResolvedValue(1);
        const result = await PostService.search(
            { lifecycle: LifecycleStatusEnum.ARCHIVED, limit: 10, offset: 0 },
            admin
        );
        expect(result.posts.length).toBe(1);
        expect(result.posts[0]?.lifecycleState).toBe(LifecycleStatusEnum.ARCHIVED);
    });

    it('filters by visibility (enum)', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue([mockPosts[1]]);
        (PostModel.count as unknown as Mock).mockResolvedValue(1);
        const result = await PostService.search(
            { visibility: VisibilityEnum.PRIVATE, limit: 10, offset: 0 },
            admin
        );
        expect(result.posts.length).toBe(1);
        expect(result.posts[0]?.visibility).toBe(VisibilityEnum.PRIVATE);
    });

    it('filters by title', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue([mockPosts[0]]);
        (PostModel.count as unknown as Mock).mockResolvedValue(1);
        const result = await PostService.search({ title: 'A', limit: 10, offset: 0 }, admin);
        expect(result.posts.length).toBe(1);
        expect(result.posts[0]?.title).toBe('A');
    });

    it('filters by authorId', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue([mockPosts[0]]);
        (PostModel.count as unknown as Mock).mockResolvedValue(1);
        if (mockPosts[0]) {
            const result = await PostService.search(
                { authorId: mockPosts[0].authorId, limit: 10, offset: 0 },
                admin
            );
            expect(result.posts.length).toBe(1);
            expect(result.posts[0]?.authorId).toBe(mockPosts[0].authorId);
        }
    });

    it('returns empty array and total 0 if no posts match', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue([]);
        (PostModel.count as unknown as Mock).mockResolvedValue(0);
        const result = await PostService.search({ title: 'ZZZ', limit: 10, offset: 0 }, admin);
        expect(result.posts.length).toBe(0);
        expect(result.total).toBe(0);
    });

    it('respects pagination (limit/offset)', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue([mockPosts[1], mockPosts[2]]);
        (PostModel.count as unknown as Mock).mockResolvedValue(4);
        const result = await PostService.search({ limit: 2, offset: 1 }, admin);
        expect(result.posts.length).toBe(2);
        expect(result.total).toBe(4);
    });

    it('orders posts by title asc', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue([mockPosts[0], mockPosts[2]]);
        (PostModel.count as unknown as Mock).mockResolvedValue(2);
        const result = await PostService.search(
            { limit: 10, offset: 0, order: 'asc', orderBy: 'title' },
            admin
        );
        expect(result.posts).toHaveLength(2);
        if (Array.isArray(result.posts) && result.posts[0] && result.posts[1]) {
            expect(result.posts[0].title <= result.posts[1].title).toBe(true);
        }
    });

    it('orders posts by title desc', async () => {
        (PostModel.search as unknown as Mock).mockResolvedValue([mockPosts[2], mockPosts[0]]);
        (PostModel.count as unknown as Mock).mockResolvedValue(2);
        const result = await PostService.search(
            { limit: 10, offset: 0, order: 'desc', orderBy: 'title' },
            admin
        );
        expect(result.posts).toHaveLength(2);
        if (Array.isArray(result.posts) && result.posts[0] && result.posts[1]) {
            expect(result.posts[0].title >= result.posts[1].title).toBe(true);
        }
    });
});
