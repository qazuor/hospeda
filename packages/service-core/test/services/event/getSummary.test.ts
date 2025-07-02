import { EventModel } from '@repo/db';
import { type EventId, PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

describe('EventService.getSummary', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createUser();
    const event = createMockEvent({ visibility: VisibilityEnum.PUBLIC });

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findById']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService(modelMock, loggerMock);
    });

    it('should return summary for a valid public event', async () => {
        asMock(modelMock.findById).mockResolvedValue(event);
        const result = await service.getSummary(actorWithPerm, { id: event.id });
        expectSuccess(result);
        expect(result.data?.summary).toEqual({
            id: event.id,
            slug: event.slug,
            name: event.name,
            category: event.category,
            date: event.date,
            media: event.media,
            isFeatured: event.isFeatured
        });
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(null);
        const result = await service.getSummary(actorWithPerm, {
            id: '11111111-1111-1111-1111-111111111111' as EventId
        });
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN if actor cannot view the event', async () => {
        const privateEvent = createMockEvent({ visibility: VisibilityEnum.PRIVATE });
        asMock(modelMock.findById).mockResolvedValue(privateEvent);
        const result = await service.getSummary(actorNoPerm, { id: privateEvent.id });
        expectForbiddenError(result);
    });

    it('should return UNAUTHORIZED if actor is undefined', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getSummary(undefined, { id: event.id });
        expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getSummary(actorWithPerm, {});
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.getSummary(actorWithPerm, { id: event.id });
        expectInternalError(result);
    });
});
