import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
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

describe('PostService.restore', () => {
    let service: PostService;
    let modelMock: PostModel;
    let post: ReturnType<typeof createMockPost>;
    let actorWithPerm: ReturnType<typeof createActor>;
    let postId: string;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findById', 'restore']);
        service = createServiceTestInstance(PostService, modelMock);
        post = createMockPost({ deletedAt: new Date() });
        postId = post.id;
        actorWithPerm = createActor({ permissions: [PermissionEnum.POST_RESTORE] });
    });

    it('should restore the post if actor has permission and post is deleted', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.restore as Mock).mockResolvedValue(1);
        const result = await service.restore(actorWithPerm, postId);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
        expect(modelMock.restore as Mock).toHaveBeenCalledWith({ id: postId });
    });

    it('should return FORBIDDEN if actor cannot restore the post', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        const forbiddenActor = createActor({
            permissions: [],
            id: 'not-the-author-id',
            role: RoleEnum.USER
        });
        const result = await service.restore(forbiddenActor, postId);
        expectForbiddenError(result);
        expect(modelMock.restore as Mock).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if post does not exist', async () => {
        (modelMock.findById as Mock).mockResolvedValue(null);
        const result = await service.restore(actorWithPerm, postId);
        expectNotFoundError(result);
    });

    it('should return count 0 if post is already restored', async () => {
        const restoredPost = { ...post, deletedAt: undefined };
        (modelMock.findById as Mock).mockResolvedValue(restoredPost);
        const result = await service.restore(actorWithPerm, postId);
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
        expect(modelMock.restore as Mock).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if model.restore throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.restore as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.restore(actorWithPerm, postId);
        expectInternalError(result);
    });
});
