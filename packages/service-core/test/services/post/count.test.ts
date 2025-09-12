import { PostModel } from '@repo/db';
import { RoleEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.count', () => {
    let service: PostService;
    let modelMock: PostModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['count']);
        service = createServiceTestInstance(PostService, modelMock);
        actor = createActor({ permissions: [], id: 'actor-id', role: RoleEnum.USER });
    });

    it('should return the count of posts if actor is authenticated', async () => {
        (modelMock.count as Mock).mockResolvedValue(42);
        const result = await service.count(actor, { page: 1, pageSize: 10 });
        expectSuccess(result);
        expect(result.data?.count).toBe(42);
    });

    it('should return FORBIDDEN if actor is not authenticated', async () => {
        const forbiddenActor = createActor({
            permissions: [],
            id: undefined,
            role: RoleEnum.GUEST
        });
        const result = await service.count(forbiddenActor, { page: 1, pageSize: 10 });
        expectForbiddenError(result);
        expect(modelMock.count as Mock).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if model.count throws', async () => {
        (modelMock.count as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.count(actor, { page: 1, pageSize: 10 });
        expectInternalError(result);
    });
});
