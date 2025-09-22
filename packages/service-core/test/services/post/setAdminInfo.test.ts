import { PostModel } from '@repo/db';
import { type AdminInfoType, PermissionEnum, type Post, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, it } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost, getMockPostId } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectNotFoundError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

type Actor = ReturnType<typeof createActor>;
let modelMock: PostModel;
let loggerMock: ReturnType<typeof createLoggerMock>;

function asMock(fn: unknown) {
    return fn as import('vitest').MockInstance;
}

describe('PostService - setAdminInfo', () => {
    let service: PostService;
    let superAdmin: Actor;
    let entity: Post;

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
        superAdmin = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.POST_UPDATE]
        });
        entity = createMockPost({ id: getMockPostId('post-entity-id') });
        asMock(modelMock.findById).mockResolvedValue(entity);
        asMock(modelMock.update).mockResolvedValue({
            ...entity,
            adminInfo: { favorite: true }
        });
    });

    it('should return FORBIDDEN if user has no permission', async () => {
        const forbiddenPost = createMockPost({ id: getMockPostId('post-entity-id') });
        const forbiddenActor = createActor({
            id: getMockId('user', 'actor-id-different'),
            role: RoleEnum.USER,
            permissions: []
        });
        asMock(modelMock.findById).mockResolvedValue(forbiddenPost);
        const result = await service.setAdminInfo({
            actor: forbiddenActor,
            id: forbiddenPost.id,
            adminInfo: { favorite: true }
        });
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if post does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(undefined);
        const result = await service.setAdminInfo({
            actor: superAdmin,
            id: getMockPostId('not-exist'),
            adminInfo: { favorite: true }
        });
        expectNotFoundError(result);
    });

    it('should return VALIDATION_ERROR for invalid adminInfo', async () => {
        const entity = createMockPost({ id: getMockPostId('post-entity-id') });
        asMock(modelMock.findById).mockResolvedValue(entity);
        const result = await service.setAdminInfo({
            actor: superAdmin,
            id: entity.id,
            adminInfo: {} as AdminInfoType
        });
        expectValidationError(result);
    });
});
