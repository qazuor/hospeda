import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockDestinationId } from '../factories/destinationFactory';
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
const destinationId = getMockDestinationId('dest-uuid');
const publicPostId = getMockPostId('public-post-uuid');
const posts = [
    getMockPost({
        id: publicPostId,
        relatedDestinationId: destinationId,
        visibility: VisibilityEnum.PUBLIC,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('private-post-uuid'),
        relatedDestinationId: destinationId,
        visibility: VisibilityEnum.PRIVATE,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('other-public-post-uuid'),
        relatedDestinationId: getMockDestinationId('other-dest'),
        visibility: VisibilityEnum.PUBLIC,
        authorId: getMockUserId('other-author-uuid')
    })
];

beforeEach(() => {
    vi.clearAllMocks();
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
                input: { destinationId: destinationId }
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
                input: { destinationId: destinationId }
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
            expect(post.id).toBe(publicPostId);
            expect(post.visibility).toBe(VisibilityEnum.PUBLIC);
        }
        expectInfoLog(
            {
                actor: expect.objectContaining({ role: 'USER' }),
                input: { destinationId: destinationId }
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
