import { EventModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
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
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should return summary for a valid public event', async () => {
        asMock(modelMock.findById).mockResolvedValue(event);
        const result = await service.getSummary(actorWithPerm, { eventId: event.id });
        expectSuccess(result);
        expect(result.data).toEqual({
            id: event.id,
            slug: event.slug,
            name: event.name,
            summary: event.summary,
            description: event.description,
            category: event.category,
            date: event.date,
            pricing: event.pricing,
            isFeatured: event.isFeatured,
            createdAt: event.createdAt
        });
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(null);
        const result = await service.getSummary(actorWithPerm, {
            eventId: '00000000-0000-4000-8000-000000000000'
        });
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN if actor cannot view the event', async () => {
        const privateEvent = createMockEvent({ visibility: VisibilityEnum.PRIVATE });
        asMock(modelMock.findById).mockResolvedValue(privateEvent);
        const result = await service.getSummary(actorNoPerm, { eventId: privateEvent.id });
        expectForbiddenError(result);
    });

    it('should return UNAUTHORIZED if actor is undefined', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getSummary(undefined, { eventId: event.id });
        expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getSummary(actorWithPerm, {});
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.getSummary(actorWithPerm, { eventId: event.id });
        expectInternalError(result);
    });
});
