import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import {
    expectForeignRowMasked,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock, makePostMediaModelStub } from '../../utils/modelMockFactory';

describe('PostService.updateVisibility', () => {
    let service: PostService;
    let modelMock: PostModel;
    let post: ReturnType<typeof createMockPost>;
    let actorWithPerm: ReturnType<typeof createActor>;
    let postId: string;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findById', 'update']);
        service = createServiceTestInstance(
            PostService,
            modelMock,
            undefined,
            null,
            undefined,
            makePostMediaModelStub()
        );
        post = createMockPost({ visibility: VisibilityEnum.PUBLIC });
        postId = post.id;
        actorWithPerm = createActor({
            permissions: [PermissionEnum.POST_UPDATE],
            id: 'actor-id',
            roles: [RoleEnum.USER]
        });
    });

    it('should update the visibility if actor has permission', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.update as Mock).mockResolvedValue({
            ...post,
            visibility: VisibilityEnum.PRIVATE
        });
        const result = await service.updateVisibility(
            actorWithPerm,
            postId,
            VisibilityEnum.PRIVATE
        );
        expectSuccess(result);
        expect(result.data?.visibility).toBe(VisibilityEnum.PRIVATE);
        expect(modelMock.update as Mock).toHaveBeenCalledWith(
            { id: postId },
            { visibility: VisibilityEnum.PRIVATE },
            undefined
        );
    });

    // HOS-706 — see `update.test.ts`. `updateVisibility` runs its gate outside
    // `_getAndValidateEntity`, so it needed its own wiring through the mask.
    it('refuses a non-author without revealing that the post exists', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        const forbiddenActor = createActor({
            permissions: [],
            id: 'not-the-author-id',
            roles: [RoleEnum.USER]
        });
        const result = await service.updateVisibility(
            forbiddenActor,
            postId,
            VisibilityEnum.PRIVATE
        );
        expectForeignRowMasked(result);
        expect(modelMock.update as Mock).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if post does not exist', async () => {
        (modelMock.findById as Mock).mockResolvedValue(null);
        const result = await service.updateVisibility(
            actorWithPerm,
            postId,
            VisibilityEnum.PRIVATE
        );
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model.update throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.update as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.updateVisibility(
            actorWithPerm,
            postId,
            VisibilityEnum.PRIVATE
        );
        expectInternalError(result);
    });
});
