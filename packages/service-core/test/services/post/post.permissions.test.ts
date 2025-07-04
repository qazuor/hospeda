import type { PostId, UserId } from '@repo/types';
import { PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
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

const baseActor = { id: '1', permissions: [], role: RoleEnum.USER };
const authorId = getMockId('user', 'author-1') as UserId;
const post = createMockPost({
    id: getMockId('post', 'p1') as PostId,
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

describe('checkCanUpdatePost', () => {
    it('should allow actor with POST_UPDATE permission', () => {
        const actor = createActor({ ...baseActor, permissions: [PermissionEnum.POST_UPDATE] });
        expect(() => checkCanUpdatePost(actor, post)).not.toThrow();
    });
    it('should allow author with USER or EDITOR role', () => {
        const actorUser = createActor({ id: authorId, role: RoleEnum.USER });
        expect(() => checkCanUpdatePost(actorUser, post)).not.toThrow();
        const actorEditor = createActor({ id: authorId, role: RoleEnum.EDITOR });
        expect(() => checkCanUpdatePost(actorEditor, post)).not.toThrow();
    });
    it('should throw ServiceError if not author and lacks permission', () => {
        const actor = createActor({ ...baseActor, id: getMockId('user', 'not-author') as UserId });
        expect(() => checkCanUpdatePost(actor, post)).toThrow(ServiceError);
    });
});

describe('checkCanDeletePost', () => {
    it('should allow actor with POST_DELETE permission', () => {
        const actor = createActor({ ...baseActor, permissions: [PermissionEnum.POST_DELETE] });
        expect(() => checkCanDeletePost(actor, post)).not.toThrow();
    });
    it('should allow author with USER or EDITOR role', () => {
        const actorUser = createActor({ id: authorId, role: RoleEnum.USER });
        expect(() => checkCanDeletePost(actorUser, post)).not.toThrow();
        const actorEditor = createActor({ id: authorId, role: RoleEnum.EDITOR });
        expect(() => checkCanDeletePost(actorEditor, post)).not.toThrow();
    });
    it('should throw ServiceError if not author and lacks permission', () => {
        const actor = createActor({ ...baseActor, id: getMockId('user', 'not-author') as UserId });
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
        const actor = createActor({ id: authorId, role: RoleEnum.USER });
        expect(() => checkCanViewPost(actor, privatePost)).not.toThrow();
    });
    it('should throw ServiceError if not author and lacks permission for private', () => {
        const privatePost = createMockPost({ ...post, visibility: VisibilityEnum.PRIVATE });
        const actor = createActor({ ...baseActor, id: getMockId('user', 'not-author') as UserId });
        expect(() => checkCanViewPost(actor, privatePost)).toThrow(ServiceError);
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
