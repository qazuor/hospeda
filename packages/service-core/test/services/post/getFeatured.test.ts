import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
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

describe('PostService.getFeatured', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = {
        id: 'ee11cbb1-7080-4727-9ed2-fa4cd82060da',
        role: RoleEnum.USER,
        permissions: []
    };

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
    });

    it('should return featured posts (success)', async () => {
        const posts = [
            createMockPost({ isFeatured: true }),
            createMockPost({ id: getMockId('post', '2') as PostId, isFeatured: true })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 2 });
        const params = {};
        const result = await service.getFeatured(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ isFeatured: true });
    });

    it('should filter by visibility', async () => {
        const posts = [createMockPost({ isFeatured: true, visibility: VisibilityEnum.PRIVATE })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = { visibility: VisibilityEnum.PRIVATE };
        const result = await service.getFeatured(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            isFeatured: true,
            visibility: VisibilityEnum.PRIVATE
        });
    });

    it('should filter by fromDate and toDate', async () => {
        const posts = [createMockPost({ isFeatured: true, createdAt: new Date('2024-07-01') })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = { fromDate: new Date('2024-07-01'), toDate: new Date('2024-07-31') };
        const result = await service.getFeatured(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            isFeatured: true,
            createdAt: { gte: params.fromDate, lte: params.toDate }
        });
    });

    it('should return empty list if no featured found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const params = {};
        const result = await service.getFeatured(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        // purposely invalid
        const result = await service.getFeatured(null as any, {} as any);
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // purposely invalid input: invalid date and extra field
        const result = await service.getFeatured(actor, {
            fromDate: 'not-a-date',
            foo: 'bar'
        } as any);
        expectValidationError(result);
    });

    it('should return internal error if model fails', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const params = {};
        const result = await service.getFeatured(actor, params);
        expectInternalError(result);
    });
});
