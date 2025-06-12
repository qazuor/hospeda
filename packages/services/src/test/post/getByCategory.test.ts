import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { PostCategoryEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockPost } from '../factories/postFactory';
import { getMockPublicUser, getMockUser } from '../factories/userFactory';

const mockPosts = [
    getMockPost({
        id: 'post-1' as PostId,
        visibility: VisibilityEnum.PUBLIC,
        title: 'A',
        category: PostCategoryEnum.GENERAL
    }),
    getMockPost({
        id: 'post-2' as PostId,
        visibility: VisibilityEnum.PRIVATE,
        title: 'B',
        category: PostCategoryEnum.EVENTS
    }),
    getMockPost({
        id: 'post-3' as PostId,
        visibility: VisibilityEnum.PUBLIC,
        title: 'C',
        category: PostCategoryEnum.GENERAL
    }),
    getMockPost({
        id: 'post-4' as PostId,
        visibility: VisibilityEnum.DRAFT,
        title: 'D',
        category: PostCategoryEnum.CULTURE
    })
];

const admin = getMockUser({ role: RoleEnum.ADMIN });
const publicUser = getMockPublicUser();

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PostService.getByCategory', () => {
    it('returns only PUBLIC posts for public user', async () => {
        (PostModel.getByCategory as unknown as Mock).mockResolvedValue(
            mockPosts.filter((p) => p.category === PostCategoryEnum.GENERAL)
        );
        const result = await PostService.getByCategory(
            { category: PostCategoryEnum.GENERAL, limit: 10, offset: 0 },
            publicUser
        );
        expect(result.posts.every((p) => p.visibility === VisibilityEnum.PUBLIC)).toBe(true);
    });

    it('returns all posts for admin', async () => {
        (PostModel.getByCategory as unknown as Mock).mockResolvedValue(
            mockPosts.filter((p) => p.category === PostCategoryEnum.GENERAL)
        );
        const result = await PostService.getByCategory(
            { category: PostCategoryEnum.GENERAL, limit: 10, offset: 0 },
            admin
        );
        expect(result.posts.length).toBe(2);
    });

    it('respects pagination (limit/offset)', async () => {
        (PostModel.getByCategory as unknown as Mock).mockResolvedValue(
            mockPosts.filter((p) => p.category === PostCategoryEnum.GENERAL)
        );
        const result = await PostService.getByCategory(
            { category: PostCategoryEnum.GENERAL, limit: 1, offset: 1 },
            admin
        );
        expect(result.posts.length).toBe(1);
        expect(result.posts[0]?.title).toBe('C');
    });

    it('orders posts by title asc', async () => {
        (PostModel.getByCategory as unknown as Mock).mockResolvedValue([
            getMockPost({
                id: 'post-2' as PostId,
                visibility: VisibilityEnum.PUBLIC,
                title: 'B',
                category: PostCategoryEnum.GENERAL
            }),
            getMockPost({
                id: 'post-1' as PostId,
                visibility: VisibilityEnum.PUBLIC,
                title: 'A',
                category: PostCategoryEnum.GENERAL
            })
        ]);
        const result = await PostService.getByCategory(
            {
                category: PostCategoryEnum.GENERAL,
                limit: 10,
                offset: 0,
                order: 'asc',
                orderBy: 'title'
            },
            admin
        );
        expect(result.posts[0]?.title).toBe('A');
        expect(result.posts[1]?.title).toBe('B');
    });

    it('orders posts by title desc', async () => {
        (PostModel.getByCategory as unknown as Mock).mockResolvedValue([
            getMockPost({
                id: 'post-1' as PostId,
                visibility: VisibilityEnum.PUBLIC,
                title: 'A',
                category: PostCategoryEnum.GENERAL
            }),
            getMockPost({
                id: 'post-2' as PostId,
                visibility: VisibilityEnum.PUBLIC,
                title: 'B',
                category: PostCategoryEnum.GENERAL
            })
        ]);
        const result = await PostService.getByCategory(
            {
                category: PostCategoryEnum.GENERAL,
                limit: 10,
                offset: 0,
                order: 'desc',
                orderBy: 'title'
            },
            admin
        );
        expect(result.posts[0]?.title).toBe('B');
        expect(result.posts[1]?.title).toBe('A');
    });

    it('returns empty array if no posts match', async () => {
        (PostModel.getByCategory as unknown as Mock).mockResolvedValue([]);
        const result = await PostService.getByCategory(
            { category: PostCategoryEnum.FESTIVALS, limit: 10, offset: 0 },
            admin
        );
        expect(result.posts.length).toBe(0);
    });
});
