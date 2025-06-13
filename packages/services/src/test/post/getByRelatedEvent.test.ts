import { PostModel } from '@repo/db';
import { VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockEventId } from '../factories/eventFactory';
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
const eventId = getMockEventId('event-uuid');
const posts = [
    getMockPost({
        id: getMockPostId('public-post-uuid'),
        relatedEventId: eventId,
        visibility: VisibilityEnum.PUBLIC,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('private-post-uuid'),
        relatedEventId: eventId,
        visibility: VisibilityEnum.PRIVATE,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('other-public-post-uuid'),
        relatedEventId: getMockEventId('other-event'),
        visibility: VisibilityEnum.PUBLIC,
        authorId: getMockUserId('other-author-uuid')
    })
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PostService.getByRelatedEvent', () => {
    it('should return only public posts for public user', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = { eventId };
        const result = await PostService.getByRelatedEvent(input, publicUser);
        expect(result.posts).toEqual([
            expect.objectContaining({
                relatedEventId: eventId,
                visibility: VisibilityEnum.PUBLIC
            })
        ]);
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'GUEST' }), input: { eventId: eventId } },
            'getByRelatedEvent:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedEvent:end'
        );
    });

    it('should return all related posts for admin', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = { eventId };
        const result = await PostService.getByRelatedEvent(input, admin);
        expect(result.posts).toEqual([
            expect.objectContaining({
                relatedEventId: eventId,
                visibility: VisibilityEnum.PUBLIC
            }),
            expect.objectContaining({
                relatedEventId: eventId,
                visibility: VisibilityEnum.PRIVATE
            })
        ]);
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'ADMIN' }), input: { eventId: eventId } },
            'getByRelatedEvent:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedEvent:end'
        );
    });

    it('should return only public posts for user without permission', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = { eventId };
        const result = await PostService.getByRelatedEvent(input, user);
        expect(result.posts).toHaveLength(1);
        const post = result.posts[0];
        expect(post).toBeDefined();
        if (post) {
            expect(post.id).toBe(getMockPostId('public-post-uuid'));
            expect(post.visibility).toBe(VisibilityEnum.PUBLIC);
        }
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: { eventId: eventId } },
            'getByRelatedEvent:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedEvent:end'
        );
    });

    it('should throw and log if input is invalid', async () => {
        const input = { eventId: '' };
        await expect(PostService.getByRelatedEvent(input, user)).rejects.toThrow();
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: { eventId: '' } },
            'getByRelatedEvent:start'
        );
    });
});
