import { PostModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.search', () => {
    let service: PostService;
    let modelMock: PostModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['search']);
        service = createServiceTestInstance(PostService, modelMock);
        actor = createActor({ permissions: [], id: 'actor-id', role: RoleEnum.USER });
    });

    it('should return a paginated list of posts if actor is authenticated', async () => {
        const posts = [createMockPost(), createMockPost()];
        (modelMock.findAll as Mock).mockResolvedValue({
            items: posts,
            page: 1,
            pageSize: 20,
            total: 2
        });
        const result = await service.search(actor, { page: 1, pageSize: 10 });
        expectSuccess(result);
        expect(result.data).toBeDefined();
        if (!result.data) throw new Error('Missing data');
        expect(result.data.items).toBeDefined();
        expect(result.data.items).toHaveLength(2);
        const [firstResult] = result.data.items;
        const [firstPost] = posts;
        if (!firstResult || !firstPost) throw new Error('No items in result or posts');
        expect(firstResult.id).toBe(firstPost.id);
    });

    it('should return FORBIDDEN if actor is not authenticated', async () => {
        const forbiddenActor = createActor({
            permissions: [],
            id: undefined,
            role: RoleEnum.GUEST
        });
        const result = await service.search(forbiddenActor, { page: 1, pageSize: 10 });
        expectForbiddenError(result);
        expect(modelMock.findAll as Mock).not.toHaveBeenCalled();
    });

    it('should return an empty list if there are no posts', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({
            items: [],
            page: 1,
            pageSize: 20,
            total: 0
        });
        const result = await service.search(actor, { page: 1, pageSize: 10 });
        expectSuccess(result);
        expect(result.data).toBeDefined();
        if (!result.data) throw new Error('Missing data');
        expect(result.data.items).toBeDefined();
        expect(result.data.items).toHaveLength(0);
    });

    it('should return INTERNAL_ERROR if model.search throws', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.search(actor, { page: 1, pageSize: 10 });
        expectInternalError(result);
    });
});
