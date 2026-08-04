import type { PostIdType, UserIdType } from '@repo/schemas';
import {
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanCommentPost,
    checkCanCreatePost,
    checkCanDeletePost,
    checkCanHardDeletePost,
    checkCanLikePost,
    checkCanRestorePost,
    checkCanUpdatePost,
    checkCanViewPost
} from '../../../src/services/post/post.permissions';
import { ServiceError } from '../../../src/types';
import { createActor, createGuestActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';

const baseActor = { id: '1', permissions: [], roles: [RoleEnum.USER] };
const authorId = getMockId('user', 'author-1') as UserIdType;
const post = createMockPost({
    id: getMockId('post', 'p1') as PostIdType,
    authorId,
    visibility: VisibilityEnum.PUBLIC
});

describe('checkCanCreatePost', () => {
    it('should allow actor with POST_CREATE permission', () => {
        const actor = createActor({ ...baseActor, permissions: [PermissionEnum.POST_CREATE] });
        expect(() => checkCanCreatePost(actor)).not.toThrow();
    });
    it('should throw ServiceError if actor lacks permission', () => {
        expect(() => checkCanCreatePost(baseActor)).toThrow(ServiceError);
    });
});

// HOS-374 §7.6.2/§7.6.3. Two changes to this block, both deliberate:
//  1. Authorship alone no longer authorizes anything. Until HOS-374 an actor
//     whose id matched `authorId` could update AND delete with zero permissions.
//     The author path now requires POST_UPDATE_OWN / POST_DELETE_OWN.
//  2. The author path carries a state lock: once the platform APPROVED the post,
//     its author can no longer edit it unless they also hold POST_PUBLISH_OWN.
//     `post` above is APPROVED (the factory default), `pendingPost` is not.
describe('checkCanUpdatePost', () => {
    const pendingPost = createMockPost({
        id: getMockId('post', 'p1-pending') as PostIdType,
        authorId,
        visibility: VisibilityEnum.PUBLIC,
        moderationState: ModerationStatusEnum.PENDING
    });

    it('should allow actor with POST_UPDATE permission (any post, any moderation state)', () => {
        const actor = createActor({ ...baseActor, permissions: [PermissionEnum.POST_UPDATE] });
        expect(() => checkCanUpdatePost(actor, post)).not.toThrow();
    });
    it('should allow the author with POST_UPDATE_OWN while the post is not approved', () => {
        const author = createActor({
            id: authorId,
            roles: [RoleEnum.EDITOR],
            permissions: [PermissionEnum.POST_UPDATE_OWN]
        });
        expect(() => checkCanUpdatePost(author, pendingPost)).not.toThrow();
    });
    it('should allow the author with POST_UPDATE_OWN on a REJECTED post — the lock is APPROVED-only', () => {
        const rejectedPost = createMockPost({
            id: getMockId('post', 'p1-rejected') as PostIdType,
            authorId,
            moderationState: ModerationStatusEnum.REJECTED
        });
        const author = createActor({
            id: authorId,
            roles: [RoleEnum.EDITOR],
            permissions: [PermissionEnum.POST_UPDATE_OWN]
        });
        expect(() => checkCanUpdatePost(author, rejectedPost)).not.toThrow();
    });
    it('should refuse the author with only POST_UPDATE_OWN once the post is APPROVED', () => {
        const author = createActor({
            id: authorId,
            roles: [RoleEnum.EDITOR],
            permissions: [PermissionEnum.POST_UPDATE_OWN]
        });
        expect(() => checkCanUpdatePost(author, post)).toThrow(ServiceError);
    });
    it('should let a trusted author (POST_PUBLISH_OWN) edit their own APPROVED post', () => {
        const trustedAuthor = createActor({
            id: authorId,
            roles: [RoleEnum.EDITOR],
            permissions: [PermissionEnum.POST_UPDATE_OWN, PermissionEnum.POST_PUBLISH_OWN]
        });
        expect(() => checkCanUpdatePost(trustedAuthor, post)).not.toThrow();
    });
    it('should throw ServiceError for the author with no permission at all', () => {
        const author = createActor({ id: authorId, roles: [RoleEnum.USER] });
        expect(() => checkCanUpdatePost(author, pendingPost)).toThrow(ServiceError);
    });
    it('should throw ServiceError for a non-author holding POST_UPDATE_OWN', () => {
        const stranger = createActor({
            id: getMockId('user', 'not-author') as UserIdType,
            permissions: [PermissionEnum.POST_UPDATE_OWN]
        });
        expect(() => checkCanUpdatePost(stranger, pendingPost)).toThrow(ServiceError);
    });
    it('should throw ServiceError if not author and lacks permission', () => {
        const actor = createActor({
            ...baseActor,
            id: getMockId('user', 'not-author') as UserIdType
        });
        expect(() => checkCanUpdatePost(actor, post)).toThrow(ServiceError);
    });
});

describe('checkCanDeletePost', () => {
    it('should allow actor with POST_DELETE permission', () => {
        const actor = createActor({ ...baseActor, permissions: [PermissionEnum.POST_DELETE] });
        expect(() => checkCanDeletePost(actor, post)).not.toThrow();
    });
    it('should allow the author with POST_DELETE_OWN', () => {
        const trustedAuthor = createActor({
            id: authorId,
            roles: [RoleEnum.EDITOR],
            permissions: [PermissionEnum.POST_DELETE_OWN]
        });
        expect(() => checkCanDeletePost(trustedAuthor, post)).not.toThrow();
    });
    it('should throw ServiceError for the author with no delete permission', () => {
        const actorUser = createActor({ id: authorId, roles: [RoleEnum.USER] });
        expect(() => checkCanDeletePost(actorUser, post)).toThrow(ServiceError);
        const actorEditor = createActor({
            id: authorId,
            roles: [RoleEnum.EDITOR],
            permissions: [PermissionEnum.POST_UPDATE_OWN]
        });
        expect(() => checkCanDeletePost(actorEditor, post)).toThrow(ServiceError);
    });
    it('should throw ServiceError for a non-author holding POST_DELETE_OWN', () => {
        const stranger = createActor({
            id: getMockId('user', 'not-author') as UserIdType,
            permissions: [PermissionEnum.POST_DELETE_OWN]
        });
        expect(() => checkCanDeletePost(stranger, post)).toThrow(ServiceError);
    });
    it('should throw ServiceError if not author and lacks permission', () => {
        const actor = createActor({
            ...baseActor,
            id: getMockId('user', 'not-author') as UserIdType
        });
        expect(() => checkCanDeletePost(actor, post)).toThrow(ServiceError);
    });
});

describe('checkCanRestorePost', () => {
    it('should allow actor with POST_RESTORE permission', () => {
        const actor = createActor({ ...baseActor, permissions: [PermissionEnum.POST_RESTORE] });
        expect(() => checkCanRestorePost(actor)).not.toThrow();
    });
    it('should throw ServiceError if actor lacks permission', () => {
        expect(() => checkCanRestorePost(baseActor)).toThrow(ServiceError);
    });
});

describe('checkCanHardDeletePost', () => {
    it('should allow actor with POST_HARD_DELETE permission', () => {
        const actor = createActor({ ...baseActor, permissions: [PermissionEnum.POST_HARD_DELETE] });
        expect(() => checkCanHardDeletePost(actor)).not.toThrow();
    });
    it('should throw ServiceError if actor lacks permission', () => {
        expect(() => checkCanHardDeletePost(baseActor)).toThrow(ServiceError);
    });
});

describe('checkCanViewPost', () => {
    it('should allow viewing public post', () => {
        expect(() => checkCanViewPost(baseActor, post)).not.toThrow();
    });
    it('should allow author to view private post', () => {
        const privatePost = createMockPost({ ...post, visibility: VisibilityEnum.PRIVATE });
        const actor = createActor({ id: authorId, roles: [RoleEnum.USER] });
        expect(() => checkCanViewPost(actor, privatePost)).not.toThrow();
    });
    it('should throw ServiceError if not author and lacks permission for private', () => {
        const privatePost = createMockPost({ ...post, visibility: VisibilityEnum.PRIVATE });
        const actor = createActor({
            ...baseActor,
            id: getMockId('user', 'not-author') as UserIdType
        });
        expect(() => checkCanViewPost(actor, privatePost)).toThrow(ServiceError);
    });

    // HOS-117 T-022: a soft-deleted PUBLIC post previously leaked a full 200
    // (checkCanViewPost had no deletedAt guard at all). Now non-author,
    // non-POST_VIEW_ALL actors get GONE (410, deindex) — but only when the post
    // was PUBLIC (indexable) before deletion; the author and staff with
    // POST_VIEW_ALL still see it for management.
    it('should throw GONE for a soft-deleted PUBLIC post when actor is not the author and lacks POST_VIEW_ALL', () => {
        const deletedPost = createMockPost({
            ...post,
            visibility: VisibilityEnum.PUBLIC,
            deletedAt: new Date()
        });
        const guestActor = createActor({
            ...baseActor,
            id: getMockId('user', 'not-author') as UserIdType
        });
        try {
            checkCanViewPost(guestActor, deletedPost);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.GONE);
            }
        }
    });

    it('should throw NOT_FOUND (not GONE) for a soft-deleted PRIVATE post — anti-enumeration (SPEC-092 T-087)', () => {
        // A PRIVATE post was never publicly discoverable, so its deletion must
        // stay a uniform 404 (never distinguishable from never-existed).
        const deletedPrivatePost = createMockPost({
            ...post,
            visibility: VisibilityEnum.PRIVATE,
            deletedAt: new Date()
        });
        const guestActor = createActor({
            ...baseActor,
            id: getMockId('user', 'not-author') as UserIdType
        });
        try {
            checkCanViewPost(guestActor, deletedPrivatePost);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
            }
        }
    });

    it('should allow the author to view their own soft-deleted post', () => {
        const deletedPost = createMockPost({
            ...post,
            visibility: VisibilityEnum.PUBLIC,
            deletedAt: new Date()
        });
        const authorActor = createActor({ id: authorId, roles: [RoleEnum.USER] });
        expect(() => checkCanViewPost(authorActor, deletedPost)).not.toThrow();
    });

    it('should allow staff with POST_VIEW_ALL to view a soft-deleted post', () => {
        const deletedPost = createMockPost({ ...post, deletedAt: new Date() });
        const staffActor = createActor({
            ...baseActor,
            id: getMockId('user', 'staff') as UserIdType,
            permissions: [PermissionEnum.POST_VIEW_ALL]
        });
        expect(() => checkCanViewPost(staffActor, deletedPost)).not.toThrow();
    });
});

describe('checkCanLikePost', () => {
    it('should allow authenticated user', () => {
        expect(() => checkCanLikePost(baseActor)).not.toThrow();
    });
    it('should throw ServiceError for guest', () => {
        const guest = createGuestActor();
        expect(() => checkCanLikePost(guest)).toThrow(ServiceError);
    });
});

describe('checkCanCommentPost', () => {
    it('should allow authenticated user', () => {
        expect(() => checkCanCommentPost(baseActor)).not.toThrow();
    });
    it('should throw ServiceError for guest', () => {
        const guest = createGuestActor();
        expect(() => checkCanCommentPost(guest)).toThrow(ServiceError);
    });
});
