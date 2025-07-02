import { EventModel } from '@repo/db';
import { PermissionEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createMockEvent, getMockEventId } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for EventService.getById
 */
describe('EventService.getById', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actor = createUser();
    const actorWithPrivate = createUser({ permissions: [PermissionEnum.EVENT_VIEW_PRIVATE] });
    const eventId = getMockEventId('event-1');

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = new EventService(modelMock, loggerMock);
    });

    it('should return a public event (success)', async () => {
        const publicEvent = createMockEvent({ id: eventId, visibility: VisibilityEnum.PUBLIC });
        (modelMock.findOne as Mock).mockResolvedValue(publicEvent);
        const result = await service.getById(actor, eventId);
        expectSuccess(result);
        expect(result.data).toMatchObject(publicEvent);
    });

    it('should return a private event if actor has EVENT_VIEW_PRIVATE', async () => {
        const privateEvent = createMockEvent({ id: eventId, visibility: VisibilityEnum.PRIVATE });
        (modelMock.findOne as Mock).mockResolvedValue(privateEvent);
        const result = await service.getById(actorWithPrivate, eventId);
        expectSuccess(result);
        expect(result.data).toMatchObject(privateEvent);
    });

    it('should return FORBIDDEN if actor lacks permission for private event', async () => {
        const privateEvent = createMockEvent({ id: eventId, visibility: VisibilityEnum.PRIVATE });
        (modelMock.findOne as Mock).mockResolvedValue(privateEvent);
        const result = await service.getById(actor, eventId);
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        (modelMock.findOne as Mock).mockResolvedValue(null);
        const result = await service.getById(actor, eventId);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model.findOne throws', async () => {
        (modelMock.findOne as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, eventId);
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterGetByField throws', async () => {
        const publicEvent = createMockEvent({ id: eventId, visibility: VisibilityEnum.PUBLIC });
        (modelMock.findOne as Mock).mockResolvedValue(publicEvent);
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.getById(actor, eventId);
        expectInternalError(result);
    });
});
