import { PostModel } from '@repo/db';
import type { EventId, PostId, UserId } from '@repo/types';
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
const eventId = 'event-uuid' as EventId;
const posts = [
    getMockPost({
        id: 'public-post-uuid' as PostId,
        relatedEventId: eventId,
        visibility: VisibilityEnum.PUBLIC,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'private-post-uuid' as PostId,
        relatedEventId: eventId,
        visibility: VisibilityEnum.PRIVATE,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'other-public-post-uuid' as PostId,
        relatedEventId: 'other-event' as EventId,
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
            { actor: expect.objectContaining({ role: 'GUEST' }), input: { eventId: 'event-uuid' } },
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
            { actor: expect.objectContaining({ role: 'ADMIN' }), input: { eventId: 'event-uuid' } },
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
            expect(post.id).toBe('public-post-uuid');
            expect(post.visibility).toBe(VisibilityEnum.PUBLIC);
        }
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: { eventId: 'event-uuid' } },
            'getByRelatedEvent:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedEvent:end'
        );
    });

    it('should throw and log if input is invalid', async () => {
        const input = { eventId: '' as PostId };
        await expect(PostService.getByRelatedEvent(input, user)).rejects.toThrow();
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: { eventId: '' } },
            'getByRelatedEvent:start'
        );
    });
});
