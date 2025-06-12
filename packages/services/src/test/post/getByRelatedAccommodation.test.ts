import { PostModel } from '@repo/db';
import type { AccommodationId, PostId, UserId } from '@repo/types';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockPost } from '../factories/postFactory';
import { getMockUser } from '../factories/userFactory';
import { expectInfoLog } from '../utils/log-assertions';

vi.mock('../../utils/permission-manager', () => ({
    hasPermission: vi.fn(() => {
        throw new Error('No permission');
    })
}));

const user = getMockUser({ id: 'not-author-uuid' as UserId, role: RoleEnum.USER });
const admin = getMockUser({ role: RoleEnum.ADMIN, id: 'admin-uuid' as UserId });
const publicUser = { role: RoleEnum.GUEST };
const accommodationId = 'acc-uuid' as AccommodationId;
const posts = [
    getMockPost({
        id: 'public-post-uuid' as PostId,
        relatedAccommodationId: accommodationId,
        visibility: VisibilityEnum.PUBLIC,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'private-post-uuid' as PostId,
        relatedAccommodationId: accommodationId,
        visibility: VisibilityEnum.PRIVATE,
        authorId: 'other-author-uuid' as UserId
    }),
    getMockPost({
        id: 'other-public-post-uuid' as PostId,
        relatedAccommodationId: 'other-acc' as AccommodationId,
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

describe('PostService.getByRelatedAccommodation', () => {
    it('should return only public posts for public user', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = { accommodationId };
        const result = await PostService.getByRelatedAccommodation(input, publicUser);
        expect(result.posts).toEqual([
            expect.objectContaining({
                relatedAccommodationId: accommodationId,
                visibility: VisibilityEnum.PUBLIC
            })
        ]);
        expectInfoLog(
            {
                actor: expect.objectContaining({ role: 'GUEST' }),
                input: { accommodationId: 'acc-uuid' }
            },
            'getByRelatedAccommodation:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedAccommodation:end'
        );
    });

    it('should return all related posts for admin', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = { accommodationId };
        const result = await PostService.getByRelatedAccommodation(input, admin);
        expect(result.posts).toEqual([
            expect.objectContaining({
                relatedAccommodationId: accommodationId,
                visibility: VisibilityEnum.PUBLIC
            }),
            expect.objectContaining({
                relatedAccommodationId: accommodationId,
                visibility: VisibilityEnum.PRIVATE
            })
        ]);
        expectInfoLog(
            {
                actor: expect.objectContaining({ role: 'ADMIN' }),
                input: { accommodationId: 'acc-uuid' }
            },
            'getByRelatedAccommodation:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedAccommodation:end'
        );
    });

    it('should return only public posts for user without permission', async () => {
        (PostModel.search as Mock).mockResolvedValue(posts);
        const input = { accommodationId };
        const result = await PostService.getByRelatedAccommodation(input, user);
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
                input: { accommodationId: 'acc-uuid' }
            },
            'getByRelatedAccommodation:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedAccommodation:end'
        );
    });

    it('should throw and log if input is invalid', async () => {
        const input = { accommodationId: '' as PostId };
        await expect(PostService.getByRelatedAccommodation(input, user)).rejects.toThrow();
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: { accommodationId: '' } },
            'getByRelatedAccommodation:start'
        );
    });
});
