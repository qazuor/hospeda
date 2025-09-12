import { PostModel } from '@repo/db';
import type { EventId, PostId } from '@repo/types';
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
import { asMock } from '../../utils/test-utils';

describe('PostService.getByRelatedEvent', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = {
        id: 'ee11cbb1-7080-4727-9ed2-fa4cd82060da',
        role: RoleEnum.USER,
        permissions: []
    };
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
        const params = { eventId };
        const result = await service.getByRelatedEvent(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ relatedEventId: eventId });
    });

    it('should filter by visibility', async () => {
        const posts = [
            createMockPost({ relatedEventId: eventId, visibility: VisibilityEnum.PRIVATE })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = { eventId, visibility: VisibilityEnum.PRIVATE };
        const result = await service.getByRelatedEvent(actor, params);
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
        const params = {
            eventId,
            fromDate: new Date('2024-07-01'),
            toDate: new Date('2024-07-31')
        };
        const result = await service.getByRelatedEvent(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            relatedEventId: eventId,
            createdAt: { gte: params.fromDate, lte: params.toDate }
        });
    });

    it('should return empty list if no posts found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const params = { eventId };
        const result = await service.getByRelatedEvent(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        // purposely invalid
        const result = await service.getByRelatedEvent(null as any, {
            eventId: eventId as EventId
        });
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // purposely invalid
        const result = await service.getByRelatedEvent(actor, { actor: 123 } as any);
        expectValidationError(result);
    });

    it('should return internal error if model fails', async () => {
        asMock(modelMock.findAll).mockRejectedValue(new Error('DB error'));
        const params = { eventId };
        const result = await service.getByRelatedEvent(actor, params);
        expectInternalError(result);
    });
});
