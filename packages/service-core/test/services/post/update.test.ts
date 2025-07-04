/**
 * @fileoverview
 * Test suite for the PostService.update method.
 * Ensures robust, type-safe, and homogeneous handling of update, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor, type createAdminActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import * as assertions from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.update', () => {
    let service: PostService;
    let modelMock: PostModel;
    let post: ReturnType<typeof createMockPost>;
    let admin: ReturnType<typeof createAdminActor>;
    let updateInput: Partial<typeof post>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findById', 'update']);
        service = createServiceTestInstance(PostService, modelMock);
        post = createMockPost();
        admin = createActor({
            permissions: [PermissionEnum.POST_UPDATE],
            role: RoleEnum.ADMIN
        });
        updateInput = { title: 'Updated Title' };
    });

    it('should update a post when permissions and input are valid', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.update as Mock).mockResolvedValue({ ...post, ...updateInput });
        const result = await service.update(admin, post.id, updateInput);
        assertions.expectSuccess(result);
        expect(result.data?.title).toBe('Updated Title');
        expect(modelMock.findById).toHaveBeenCalledWith(post.id);
        expect(modelMock.update).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.update as Mock).mockResolvedValue({ ...post, ...updateInput });
        // The actor is NOT the author of the post and has no permissions
        const forbiddenActor = createActor({
            id: 'not-the-author-id',
            permissions: [],
            role: RoleEnum.USER
        });
        const result = await service.update(forbiddenActor, post.id, updateInput);
        assertions.expectForbiddenError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(post.id);
        expect(modelMock.update).not.toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        // invalid input: empty title
        const invalidInput = { title: '' };
        const result = await service.update(admin, post.id, invalidInput);
        assertions.expectValidationError(result);
    });

    it('should return NOT_FOUND if post does not exist', async () => {
        (modelMock.findById as Mock).mockResolvedValue(null);
        const result = await service.update(admin, 'not-found-id', updateInput);
        assertions.expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.update as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.update(admin, post.id, updateInput);
        assertions.expectInternalError(result);
    });
});
