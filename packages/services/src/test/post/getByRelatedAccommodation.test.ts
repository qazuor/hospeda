import { PostModel } from '@repo/db';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../post/post.service';
import { getMockAccommodationId } from '../factories';
import { getMockPost, getMockPostId } from '../factories/postFactory';
import { getMockAdminUser, getMockUser, getMockUserId } from '../factories/userFactory';
import { expectInfoLog } from '../utils/log-assertions';

vi.mock('../../utils/permission-manager', () => ({
    hasPermission: vi.fn(() => {
        throw new Error('No permission');
    })
}));

const user = getMockUser({ id: getMockUserId('not-author-uuid') });
const admin = getMockAdminUser();
const publicUser = { role: RoleEnum.GUEST };
const accommodationId = getMockAccommodationId('acc-uuid');
const posts = [
    getMockPost({
        id: getMockPostId('public-post-uuid'),
        relatedAccommodationId: accommodationId,
        visibility: VisibilityEnum.PUBLIC,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('private-post-uuid'),
        relatedAccommodationId: accommodationId,
        visibility: VisibilityEnum.PRIVATE,
        authorId: getMockUserId('other-author-uuid')
    }),
    getMockPost({
        id: getMockPostId('other-public-post-uuid'),
        relatedAccommodationId: getMockAccommodationId('other-acc'),
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
                input: { accommodationId: accommodationId }
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
                input: { accommodationId: accommodationId }
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
            expect(post.id).toBe(getMockPostId('public-post-uuid'));
            expect(post.visibility).toBe(VisibilityEnum.PUBLIC);
        }
        expectInfoLog(
            {
                actor: expect.objectContaining({ role: 'USER' }),
                input: { accommodationId: accommodationId }
            },
            'getByRelatedAccommodation:start'
        );
        expectInfoLog(
            { result: expect.objectContaining({ posts: expect.any(Array) }) },
            'getByRelatedAccommodation:end'
        );
    });

    it('should throw and log if input is invalid', async () => {
        const input = { accommodationId: '' };
        await expect(PostService.getByRelatedAccommodation(input, user)).rejects.toThrow();
        expectInfoLog(
            { actor: expect.objectContaining({ role: 'USER' }), input: { accommodationId: '' } },
            'getByRelatedAccommodation:start'
        );
    });
});
