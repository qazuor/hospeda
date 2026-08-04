import { PostModel } from '@repo/db';
import type { UserIdType } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * HOS-374 §7.6.4 — the three dedicated state transitions.
 *
 * What these tests exist to protect is narrower than "the method works": each
 * transition must write ONLY the field it owns. The whole permission model
 * rests on that, because the reason these endpoints exist at all is that the
 * generic update let anyone with POST_UPDATE set moderationState directly.
 */
describe('PostService state transitions', () => {
    const authorId = getMockId('user', 'post-author') as UserIdType;
    const strangerId = getMockId('user', 'post-stranger') as UserIdType;

    let service: PostService;
    let modelMock: PostModel;
    let post: ReturnType<typeof createMockPost>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findById', 'update']);
        service = createServiceTestInstance(PostService, modelMock);
        post = createMockPost({
            authorId,
            visibility: VisibilityEnum.PUBLIC,
            moderationState: ModerationStatusEnum.PENDING,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.update as Mock).mockImplementation(
            async (_where: unknown, patch: Record<string, unknown>) => ({ ...post, ...patch })
        );
    });

    describe('moderate', () => {
        const moderator = () =>
            createActor({
                id: strangerId,
                roles: [RoleEnum.USER],
                permissions: [PermissionEnum.POST_MODERATION_CHANGE]
            });

        it('writes moderationState and nothing else', async () => {
            const result = await service.moderate({
                actor: moderator(),
                id: post.id,
                moderationState: ModerationStatusEnum.APPROVED
            });

            expectSuccess(result);
            expect(result.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);
            expect(modelMock.update as Mock).toHaveBeenCalledWith(
                { id: post.id },
                { moderationState: ModerationStatusEnum.APPROVED },
                undefined
            );
        });

        it('accepts PENDING so an admin can send an item back for re-review', async () => {
            const result = await service.moderate({
                actor: moderator(),
                id: post.id,
                moderationState: ModerationStatusEnum.PENDING
            });
            expectSuccess(result);
        });

        it('is refused to an actor holding POST_UPDATE but not POST_MODERATION_CHANGE', async () => {
            // The exact actor that could do this through the generic update.
            const editor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.POST_UPDATE]
            });

            const result = await service.moderate({
                actor: editor,
                id: post.id,
                moderationState: ModerationStatusEnum.APPROVED
            });

            expectForbiddenError(result);
            expect(modelMock.update as Mock).not.toHaveBeenCalled();
        });

        it('gives the author no path of their own — the verdict is the platform’s', async () => {
            const trustedAuthor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.POST_UPDATE_OWN, PermissionEnum.POST_PUBLISH_OWN]
            });

            const result = await service.moderate({
                actor: trustedAuthor,
                id: post.id,
                moderationState: ModerationStatusEnum.APPROVED
            });

            expectForbiddenError(result);
        });

        it('returns NOT_FOUND when the post does not exist', async () => {
            (modelMock.findById as Mock).mockResolvedValue(null);
            const result = await service.moderate({
                actor: moderator(),
                id: post.id,
                moderationState: ModerationStatusEnum.APPROVED
            });
            expectNotFoundError(result);
        });
    });

    describe('setPublishState', () => {
        it('writes visibility and nothing else, leaving the verdict intact', async () => {
            const admin = createActor({
                id: strangerId,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.POST_PUBLISH_TOGGLE]
            });

            const result = await service.setPublishState({
                actor: admin,
                id: post.id,
                visibility: VisibilityEnum.PRIVATE
            });

            expectSuccess(result);
            expect(modelMock.update as Mock).toHaveBeenCalledWith(
                { id: post.id },
                { visibility: VisibilityEnum.PRIVATE },
                undefined
            );
            expect(result.data?.moderationState).toBe(ModerationStatusEnum.PENDING);
        });

        it('lets a trusted author unpublish their own post', async () => {
            const trustedAuthor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.POST_PUBLISH_OWN]
            });

            const result = await service.setPublishState({
                actor: trustedAuthor,
                id: post.id,
                visibility: VisibilityEnum.PRIVATE
            });

            expectSuccess(result);
        });

        it('refuses a plain author who only holds POST_UPDATE_OWN', async () => {
            const author = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.POST_UPDATE_OWN]
            });

            const result = await service.setPublishState({
                actor: author,
                id: post.id,
                visibility: VisibilityEnum.PUBLIC
            });

            expectForbiddenError(result);
            expect(modelMock.update as Mock).not.toHaveBeenCalled();
        });

        it('refuses POST_PUBLISH_OWN on a post the actor did not author', async () => {
            const stranger = createActor({
                id: strangerId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.POST_PUBLISH_OWN]
            });

            const result = await service.setPublishState({
                actor: stranger,
                id: post.id,
                visibility: VisibilityEnum.PUBLIC
            });

            expectForbiddenError(result);
        });

        it('accepts RESTRICTED — visibility is an enum, not a published boolean', async () => {
            const admin = createActor({
                id: strangerId,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.POST_PUBLISH_TOGGLE]
            });

            const result = await service.setPublishState({
                actor: admin,
                id: post.id,
                visibility: VisibilityEnum.RESTRICTED
            });

            expectSuccess(result);
        });
    });

    describe('setLifecycleState', () => {
        it('writes lifecycleState and nothing else', async () => {
            const admin = createActor({
                id: strangerId,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.POST_LIFECYCLE_CHANGE]
            });

            const result = await service.setLifecycleState({
                actor: admin,
                id: post.id,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            });

            expectSuccess(result);
            expect(modelMock.update as Mock).toHaveBeenCalledWith(
                { id: post.id },
                { lifecycleState: LifecycleStatusEnum.ARCHIVED },
                undefined
            );
        });

        it('is refused to an actor holding POST_UPDATE but not POST_LIFECYCLE_CHANGE', async () => {
            const editor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.POST_UPDATE]
            });

            const result = await service.setLifecycleState({
                actor: editor,
                id: post.id,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            });

            expectForbiddenError(result);
            expect(modelMock.update as Mock).not.toHaveBeenCalled();
        });
    });
});
