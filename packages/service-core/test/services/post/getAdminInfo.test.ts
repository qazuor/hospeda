import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, it } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost, getMockPostId } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectNotFoundError } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

// Helper to cast a function to a Vitest mock
function asMock(fn: unknown) {
    return fn as import('vitest').MockInstance;
}

type Actor = ReturnType<typeof createActor>;
let modelMock: PostModel;
let loggerMock: ReturnType<typeof createLoggerMock>;

describe('PostService - getAdminInfo', () => {
    let service: PostService;
    let superAdmin: Actor;

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findById']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
        superAdmin = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.POST_UPDATE]
        });
        asMock(modelMock.findById).mockResolvedValue(
            createMockPost({ id: getMockPostId('post-entity-id') })
        );
    });

    it('should return FORBIDDEN if user has no permission', async () => {
        // Arrange: actor y post con IDs distintos
        const forbiddenPost = createMockPost({ id: getMockPostId('post-entity-id') });
        const forbiddenActor = createActor({
            id: getMockId('user', 'actor-id-different'),
            role: RoleEnum.USER,
            permissions: []
        });
        asMock(modelMock.findById).mockResolvedValue(forbiddenPost);
        // Act
        const result = await service.getAdminInfo({
            actor: forbiddenActor,
            id: forbiddenPost.id
        });
        // Assert
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if post does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(undefined);
        const result = await service.getAdminInfo({
            actor: superAdmin,
            id: getMockPostId('not-exist')
        });
        expectNotFoundError(result);
    });
});
