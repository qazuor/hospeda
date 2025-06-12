import { PostModel } from '@repo/db';
import type { DestinationId, PostId, UserId } from '@repo/types';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockPost, getMockUser } from '../mockData';
import { expectInfoLog } from '../utils/log-assertions';

vi.mock('../../utils/permission-manager', () => ({
    hasPermission: vi.fn(() => {
        throw new Error('No permission');
    })
}));

const user = getMockUser({ id: 'not-author-uuid' as UserId, role: RoleEnum.USER });
const admin = getMockUser({ role: RoleEnum.ADMIN, id: 'admin-uuid' as UserId });
const publicUser = { role: RoleEnum.GUEST };
const destinationId = 'dest-uuid' as DestinationId;
const posts = [
    getMockPost({
        id: 'public-post-uuid' as PostId,
        relatedDestinationId: destinationId,
        visibility: VisibilityEnum.PUBLIC,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'private-post-uuid' as PostId,
        relatedDestinationId: destinationId,
        visibility: VisibilityEnum.PRIVATE,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'other-public-post-uuid' as PostId,
        relatedDestinationId: 'other-dest' as DestinationId,
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

describe('PostService.getByRelatedDestination', () => {
    it('should return only public posts for public user', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = { destinationId };
        const result = await PostService.getByRelatedDestination(input, publicUser);
        expect(result.posts).toEqual([
            expect.objectContaining({
                relatedDestinationId: destinationId,
                visibility: VisibilityEnum.PUBLIC
            })
        ]);
        expectInfoLog(
            {
                actor: expect.objectContaining({ role: 'GUEST' }),
                input: { destinationId: 'dest-uuid' }
            },
            'getByRelatedDestination:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedDestination:end'
        );
    });

    it('should return all related posts for admin', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = { destinationId };
        const result = await PostService.getByRelatedDestination(input, admin);
        expect(result.posts).toEqual([
            expect.objectContaining({
                relatedDestinationId: destinationId,
                visibility: VisibilityEnum.PUBLIC
            }),
            expect.objectContaining({
                relatedDestinationId: destinationId,
                visibility: VisibilityEnum.PRIVATE
            })
        ]);
        expectInfoLog(
            {
                actor: expect.objectContaining({ role: 'ADMIN' }),
                input: { destinationId: 'dest-uuid' }
            },
            'getByRelatedDestination:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedDestination:end'
        );
    });

    it('should return only public posts for user without permission', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = { destinationId };
        const result = await PostService.getByRelatedDestination(input, user);
        expect(result.posts).toHaveLength(1);
        const post = result.posts[0];
        expect(post).toBeDefined();
        if (post) {
            expect(post.id).toBe('public-post-uuid');
            expect(post.visibility).toBe(VisibilityEnum.PUBLIC);
        }
        expectInfoLog(
            {
                actor: expect.objectContaining({ role: 'USER' }),
                input: { destinationId: 'dest-uuid' }
            },
            'getByRelatedDestination:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedDestination:end'
        );
    });

    it('should throw and log if input is invalid', async () => {
        const input = { destinationId: '' as PostId };
        await expect(PostService.getByRelatedDestination(input, user)).rejects.toThrow();
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: { destinationId: '' } },
            'getByRelatedDestination:start'
        );
    });
});
