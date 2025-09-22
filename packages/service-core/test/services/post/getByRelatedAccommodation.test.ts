import { PostModel } from '@repo/db';
import type { AccommodationIdType, PostIdType } from '@repo/schemas';
import { RoleEnum, VisibilityEnum } from '@repo/schemas';
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

describe('PostService.getByRelatedAccommodation', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = {
        id: 'ee11cbb1-7080-4727-9ed2-fa4cd82060da',
        role: RoleEnum.USER,
        permissions: []
    };
    const accommodationId = getMockId('accommodation') as AccommodationIdType;

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
    });

    it('should return posts by related accommodation (success)', async () => {
        const posts = [
            createMockPost({ relatedAccommodationId: accommodationId }),
            createMockPost({
                id: getMockId('post', '2') as PostIdType,
                relatedAccommodationId: accommodationId
            })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 2 });
        const params = { accommodationId };
        const result = await service.getByRelatedAccommodation(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ relatedAccommodationId: accommodationId });
    });

    it('should filter by visibility', async () => {
        const posts = [
            createMockPost({
                relatedAccommodationId: accommodationId,
                visibility: VisibilityEnum.PRIVATE
            })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = { accommodationId, visibility: VisibilityEnum.PRIVATE };
        const result = await service.getByRelatedAccommodation(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            relatedAccommodationId: accommodationId,
            visibility: VisibilityEnum.PRIVATE
        });
    });

    it('should filter by fromDate and toDate', async () => {
        const posts = [
            createMockPost({
                relatedAccommodationId: accommodationId,
                createdAt: new Date('2024-07-01')
            })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = {
            accommodationId,
            fromDate: new Date('2024-07-01'),
            toDate: new Date('2024-07-31')
        };
        const result = await service.getByRelatedAccommodation(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            relatedAccommodationId: accommodationId,
            createdAt: { gte: params.fromDate, lte: params.toDate }
        });
    });

    it('should return empty list if no posts found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const params = { accommodationId };
        const result = await service.getByRelatedAccommodation(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        // purposely invalid
        const result = await service.getByRelatedAccommodation(null as any, {
            accommodationId: accommodationId as AccommodationIdType
        });
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // purposely invalid
        const result = await service.getByRelatedAccommodation(actor, { actor: 123 } as any);
        expectValidationError(result);
    });

    it('should return internal error if model fails', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const params = { accommodationId };
        const result = await service.getByRelatedAccommodation(actor, params);
        expectInternalError(result);
    });
});
