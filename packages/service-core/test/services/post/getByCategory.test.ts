import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { PostCategoryEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import type { ServiceInput } from '../../../src/types';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.getByCategory', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = createActor({ id: getMockId('user') });
    const category = PostCategoryEnum.GENERAL;

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
    });

    it('should return posts by category (success)', async () => {
        const posts = [
            createMockPost({ category }),
            createMockPost({ id: getMockId('post', '2') as PostId, category })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 2 });
        const input = { actor, category };
        const result = await service.getByCategory(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ category });
    });

    it('should filter by visibility', async () => {
        const posts = [createMockPost({ category, visibility: VisibilityEnum.PRIVATE })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const input = { actor, category, visibility: VisibilityEnum.PRIVATE };
        const result = await service.getByCategory(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            category,
            visibility: VisibilityEnum.PRIVATE
        });
    });

    it('should filter by fromDate and toDate', async () => {
        const posts = [createMockPost({ category, createdAt: new Date('2024-07-01') })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const input = {
            actor,
            category,
            fromDate: new Date('2024-07-01'),
            toDate: new Date('2024-07-31')
        };
        const result = await service.getByCategory(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            category,
            createdAt: { gte: input.fromDate, lte: input.toDate }
        });
    });

    it('should return empty list if no posts found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const input = { actor, category };
        const result = await service.getByCategory(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByCategory({ category });
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByCategory({ actor: 123, category });
        expectValidationError(result);
        // missing category
        const result2 = await service.getByCategory({ actor } as unknown as ServiceInput<
            import('../../../src/services/post/post.schemas').GetByCategoryInput
        >);
        expectValidationError(result2);
    });

    it('should return internal error if model fails', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const input = { actor, category };
        const result = await service.getByCategory(input);
        expectInternalError(result);
    });
});
