import { PostModel } from '@repo/db';
import type { EventId, PostId } from '@repo/types';
import { VisibilityEnum } from '@repo/types';
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

describe('PostService.getByRelatedEvent', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = createActor({ id: getMockId('user') });
    const eventId = getMockId('event') as EventId;

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
    });

    it('should return posts by related event (success)', async () => {
        const posts = [
            createMockPost({ relatedEventId: eventId }),
            createMockPost({ id: getMockId('post', '2') as PostId, relatedEventId: eventId })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 2 });
        const input = { actor, eventId };
        const result = await service.getByRelatedEvent(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ relatedEventId: eventId });
    });

    it('should filter by visibility', async () => {
        const posts = [
            createMockPost({ relatedEventId: eventId, visibility: VisibilityEnum.PRIVATE })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const input = { actor, eventId, visibility: VisibilityEnum.PRIVATE };
        const result = await service.getByRelatedEvent(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            relatedEventId: eventId,
            visibility: VisibilityEnum.PRIVATE
        });
    });

    it('should filter by fromDate and toDate', async () => {
        const posts = [
            createMockPost({ relatedEventId: eventId, createdAt: new Date('2024-07-01') })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const input = {
            actor,
            eventId,
            fromDate: new Date('2024-07-01'),
            toDate: new Date('2024-07-31')
        };
        const result = await service.getByRelatedEvent(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            relatedEventId: eventId,
            createdAt: { gte: input.fromDate, lte: input.toDate }
        });
    });

    it('should return empty list if no posts found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const input = { actor, eventId };
        const result = await service.getByRelatedEvent(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByRelatedEvent({ eventId });
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByRelatedEvent({ actor: 123, eventId });
        expectValidationError(result);
        // missing eventId
        const result2 = await service.getByRelatedEvent({ actor } as unknown as ServiceInput<
            import('../../../src/services/post/post.schemas').GetByRelatedEventInput
        >);
        expectValidationError(result2);
    });

    it('should return internal error if model fails', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const input = { actor, eventId };
        const result = await service.getByRelatedEvent(input);
        expectInternalError(result);
    });
});
