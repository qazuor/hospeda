import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { PostCategoryEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../../src';
import { PostService } from '../../../src/services/post/post.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('PostService.getByCategory', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = {
        id: 'ee11cbb1-7080-4727-9ed2-fa4cd82060da',
        role: RoleEnum.USER,
        permissions: []
    };
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
        const params = { category };
        const result = await service.getByCategory(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ category });
    });

    it('should filter by visibility', async () => {
        const posts = [createMockPost({ category, visibility: VisibilityEnum.PRIVATE })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = { category, visibility: VisibilityEnum.PRIVATE };
        const result = await service.getByCategory(actor, params);
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
        const params = {
            category,
            fromDate: new Date('2024-07-01'),
            toDate: new Date('2024-07-31')
        };
        const result = await service.getByCategory(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            category,
            createdAt: { gte: params.fromDate, lte: params.toDate }
        });
    });

    it('should return empty list if no posts found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const params = { category };
        const result = await service.getByCategory(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        /* Should return unauthorized error if actor is missing. */
        const result = await service.getByCategory(
            undefined as unknown as Actor, // purposely invalid to simulate missing actor
            { category }
        );
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // purposely invalid
        const result = await service.getByCategory(
            actor,
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            { actor: 123 } as any
        );
        expectValidationError(result);
    });

    it('should return internal error if model fails', async () => {
        asMock(modelMock.findAll).mockRejectedValue(new Error('DB error'));
        const params = { category };
        const result = await service.getByCategory(actor, params);
        expectInternalError(result);
    });
});
