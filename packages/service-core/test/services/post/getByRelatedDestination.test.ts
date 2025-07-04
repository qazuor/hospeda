import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { type DestinationId, VisibilityEnum } from '@repo/types';
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

describe('PostService.getByRelatedDestination', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = createActor({ id: getMockId('user') });
    const destinationId = getMockId('destination') as DestinationId;

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
    });

    it('should return posts by related destination (success)', async () => {
        const posts = [
            createMockPost({ relatedDestinationId: destinationId }),
            createMockPost({
                id: getMockId('post', '2') as PostId,
                relatedDestinationId: destinationId
            })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 2 });
        const input = { actor, destinationId };
        const result = await service.getByRelatedDestination(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ relatedDestinationId: destinationId });
    });

    it('should filter by visibility', async () => {
        const posts = [
            createMockPost({
                relatedDestinationId: destinationId,
                visibility: VisibilityEnum.PRIVATE
            })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const input = { actor, destinationId, visibility: VisibilityEnum.PRIVATE };
        const result = await service.getByRelatedDestination(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            relatedDestinationId: destinationId,
            visibility: VisibilityEnum.PRIVATE
        });
    });

    it('should filter by fromDate and toDate', async () => {
        const posts = [
            createMockPost({
                relatedDestinationId: destinationId,
                createdAt: new Date('2024-07-01')
            })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const input = {
            actor,
            destinationId,
            fromDate: new Date('2024-07-01'),
            toDate: new Date('2024-07-31')
        };
        const result = await service.getByRelatedDestination(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            relatedDestinationId: destinationId,
            createdAt: { gte: input.fromDate, lte: input.toDate }
        });
    });

    it('should return empty list if no posts found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const input = { actor, destinationId };
        const result = await service.getByRelatedDestination(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByRelatedDestination({ destinationId });
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByRelatedDestination({ actor: 123, destinationId });
        expectValidationError(result);
        // missing destinationId
        const result2 = await service.getByRelatedDestination({ actor } as unknown as ServiceInput<
            import('../../../src/services/post/post.schemas').GetByRelatedDestinationInput
        >);
        expectValidationError(result2);
    });

    it('should return internal error if model fails', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const input = { actor, destinationId };
        const result = await service.getByRelatedDestination(input);
        expectInternalError(result);
    });
});
