import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum, type UserId, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import * as assertions from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.getById', () => {
    let service: PostService;
    let modelMock: PostModel;
    let post: ReturnType<typeof createMockPost>;
    let actor: ReturnType<typeof createActor>;
    let forbiddenActor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findOne']);
        service = createServiceTestInstance(PostService, modelMock);
        post = createMockPost();
        actor = createActor({
            id: getMockId('user'),
            permissions: [PermissionEnum.POST_VIEW_PRIVATE],
            role: RoleEnum.USER
        });
        forbiddenActor = createActor({
            id: getMockId('post'),
            permissions: [],
            role: RoleEnum.USER
        });
    });

    it('should return the post if it exists and actor has permission', async () => {
        (modelMock.findOne as Mock).mockImplementation((where) =>
            String(where.id) === String(post.id) ? post : null
        );
        const result = await service.getById(actor, post.id);
        assertions.expectSuccess(result);
        expect(result.data?.id).toBe(post.id);
    });

    it('should return FORBIDDEN if actor cannot view the post', async () => {
        // post privado, actor no es autor ni tiene permiso
        const privatePost = createMockPost({
            visibility: VisibilityEnum.PRIVATE,
            authorId: getMockId('user') as UserId
        });
        (modelMock.findOne as Mock).mockImplementation((where) =>
            String(where.id) === String(privatePost.id) ? privatePost : null
        );
        const result = await service.getById(forbiddenActor, privatePost.id);
        assertions.expectForbiddenError(result);
    });

    it('should return NOT_FOUND if post does not exist', async () => {
        (modelMock.findOne as Mock).mockResolvedValue(null);
        const result = await service.getById(actor, getMockId('post'));
        assertions.expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (modelMock.findOne as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, post.id);
        assertions.expectInternalError(result);
    });
});
