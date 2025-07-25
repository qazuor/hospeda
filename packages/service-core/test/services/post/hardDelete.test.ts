import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/types';
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

describe('PostService.hardDelete', () => {
    let service: PostService;
    let modelMock: PostModel;
    let post: ReturnType<typeof createMockPost>;
    let actorWithPerm: ReturnType<typeof createActor>;
    let postId: string;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findById', 'hardDelete']);
        service = createServiceTestInstance(PostService, modelMock);
        post = createMockPost();
        postId = post.id;
        actorWithPerm = createActor({ permissions: [PermissionEnum.POST_HARD_DELETE] });
    });

    it('should hard delete the post if actor has permission', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.hardDelete as Mock).mockResolvedValue(1);
        const result = await service.hardDelete(actorWithPerm, postId);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
        expect(modelMock.hardDelete as Mock).toHaveBeenCalledWith({ id: postId });
    });

    it('should return FORBIDDEN if actor cannot hard delete the post', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        const forbiddenActor = createActor({
            permissions: [],
            id: 'not-the-author-id',
            role: RoleEnum.USER
        });
        const result = await service.hardDelete(forbiddenActor, postId);
        expectForbiddenError(result);
        expect(modelMock.hardDelete as Mock).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if post does not exist', async () => {
        (modelMock.findById as Mock).mockResolvedValue(null);
        const result = await service.hardDelete(actorWithPerm, postId);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model.hardDelete throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.hardDelete as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.hardDelete(actorWithPerm, postId);
        expectInternalError(result);
    });
});
