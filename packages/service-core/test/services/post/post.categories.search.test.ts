/**
 * Tests that `filters.categories` reaches PostModel from PostService's
 * `search()`/`count()` public entry points (HOS-96 T-007).
 *
 * `_executeSearch`/`_executeCount` destructure only the params they need
 * special handling for (pagination/sort, `q`, `tags`) and forward the REST of
 * the validated search input — including the new `categories` array field —
 * straight to `model.findAllWithRelations()` / `model.count()` (via
 * `mapPostFilterKeysToColumns`, which passes unknown keys through as-is).
 * This suite proves that pass-through actually happens, and that the
 * singular `category` still forwards too (US-10 backward compat).
 */
import { PostModel } from '@repo/db';
import { PostCategoryEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService — categories filter forwarding (HOS-96 T-007)', () => {
    let service: PostService;
    let modelMock: PostModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['search', 'count']);
        service = createServiceTestInstance(PostService, modelMock);
        actor = createActor({ permissions: [], id: 'actor-id', role: RoleEnum.USER });
    });

    it('forwards filters.categories to model.findAllWithRelations on search()', async () => {
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({
            items: [],
            page: 1,
            pageSize: 10,
            total: 0
        });

        const result = await service.search(actor, {
            page: 1,
            pageSize: 10,
            categories: [PostCategoryEnum.CULTURE, PostCategoryEnum.GASTRONOMY]
        });

        expectSuccess(result);
        expect(modelMock.findAllWithRelations).toHaveBeenCalled();
        const whereArg = (modelMock.findAllWithRelations as Mock).mock.calls[0]?.[1];
        expect(whereArg).toMatchObject({
            categories: [PostCategoryEnum.CULTURE, PostCategoryEnum.GASTRONOMY]
        });
    });

    it('forwards filters.categories to model.count on count()', async () => {
        (modelMock.count as Mock).mockResolvedValue(0);

        const result = await service.count(actor, {
            page: 1,
            pageSize: 10,
            categories: [PostCategoryEnum.CULTURE, PostCategoryEnum.GASTRONOMY]
        });

        expectSuccess(result);
        expect(modelMock.count).toHaveBeenCalled();
        const whereArg = (modelMock.count as Mock).mock.calls[0]?.[0];
        expect(whereArg).toMatchObject({
            categories: [PostCategoryEnum.CULTURE, PostCategoryEnum.GASTRONOMY]
        });
    });

    it('still forwards the singular category alone (backward compat, US-10)', async () => {
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({
            items: [],
            page: 1,
            pageSize: 10,
            total: 0
        });

        await service.search(actor, { page: 1, pageSize: 10, category: PostCategoryEnum.CULTURE });

        const whereArg = (modelMock.findAllWithRelations as Mock).mock.calls[0]?.[1];
        expect(whereArg).toMatchObject({ category: PostCategoryEnum.CULTURE });
    });
});
