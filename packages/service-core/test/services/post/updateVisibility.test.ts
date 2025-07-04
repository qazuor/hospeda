import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.updateVisibility', () => {
    let service: PostService;
    let modelMock: PostModel;
    let post: ReturnType<typeof createMockPost>;
    let actorWithPerm: ReturnType<typeof createActor>;
    let postId: string;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findById', 'update']);
        service = createServiceTestInstance(PostService, modelMock);
        post = createMockPost({ visibility: VisibilityEnum.PUBLIC });
        postId = post.id;
        actorWithPerm = createActor({
            permissions: [PermissionEnum.POST_UPDATE],
            id: 'actor-id',
            role: RoleEnum.USER
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
            { visibility: VisibilityEnum.PRIVATE }
        );
    });

    it('should return FORBIDDEN if actor cannot update visibility', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        const forbiddenActor = createActor({
            permissions: [],
            id: 'not-the-author-id',
            role: RoleEnum.USER
        });
        const result = await service.updateVisibility(
            forbiddenActor,
            postId,
            VisibilityEnum.PRIVATE
        );
        expectForbiddenError(result);
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
