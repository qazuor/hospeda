import { PostModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.list', () => {
    let service: PostService;
    let modelMock: PostModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        service = createServiceTestInstance(PostService, modelMock);
        actor = createActor({ permissions: [], id: 'actor-id', role: RoleEnum.USER });
    });

    it('should return a list of posts if actor is authenticated', async () => {
        const posts = [createMockPost(), createMockPost()];
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({
            items: posts,
            page: 1,
            pageSize: 20,
            total: 2
        });
        const result = await service.list(actor, { page: 1, pageSize: 20 });
        expectSuccess(result);
        expect(result.data).toBeDefined();
        expect(result.data?.items).toBeDefined();
        expect(result.data?.items).toHaveLength(2);
        if (!result.data || !result.data.items) throw new Error('Missing data');
        const [firstResult] = result.data.items;
        const [firstPost] = posts;
        if (!firstResult || !firstPost) throw new Error('No items in result or posts');
        expect(firstResult.id).toBe(firstPost.id);
    });

    it('should return UNAUTHORIZED for guest users without id (actor validation requires id)', async () => {
        const guestActor = createActor({
            permissions: [],
            id: undefined,
            role: RoleEnum.GUEST
        });
        const result = await service.list(guestActor, { page: 1, pageSize: 20 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(modelMock.findAllWithRelations as Mock).not.toHaveBeenCalled();
    });

    it('should return an empty list if there are no posts', async () => {
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({
            items: [],
            page: 1,
            pageSize: 20,
            total: 0
        });
        const result = await service.list(actor, { page: 1, pageSize: 20 });
        expectSuccess(result);
        expect(result.data).toBeDefined();
        expect(result.data?.items).toBeDefined();
        expect(result.data?.items).toHaveLength(0);
    });

    it('should return INTERNAL_ERROR if model.findAll throws', async () => {
        (modelMock.findAllWithRelations as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.list(actor, { page: 1, pageSize: 20 });
        expectInternalError(result);
    });
});
