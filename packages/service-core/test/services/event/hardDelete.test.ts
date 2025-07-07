import { EventModel } from '@repo/db';
import { PermissionEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for EventService.hardDelete
 */
describe('EventService.hardDelete', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_HARD_DELETE] });
    const actorNoPerm = createUser();
    const existingEvent = createMockEvent({ visibility: VisibilityEnum.PUBLIC });
    const eventId = existingEvent.id;

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findById', 'hardDelete']);
        loggerMock = createLoggerMock();
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should hard delete an event (success)', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.hardDelete as Mock).mockResolvedValue(1);
        const result = await service.hardDelete(actorWithPerm, eventId);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
        expect(modelMock.hardDelete as Mock).toHaveBeenCalledWith({ id: eventId });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        const result = await service.hardDelete(actorNoPerm, eventId);
        expectForbiddenError(result);
        expect(modelMock.hardDelete as Mock).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        (modelMock.findById as Mock).mockResolvedValue(null);
        const result = await service.hardDelete(actorWithPerm, eventId);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model.hardDelete throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.hardDelete as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.hardDelete(actorWithPerm, eventId);
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _beforeHardDelete throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        vi.spyOn(
            service as unknown as { _beforeHardDelete: () => void },
            '_beforeHardDelete'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.hardDelete(actorWithPerm, eventId);
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterHardDelete throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.hardDelete as Mock).mockResolvedValue(1);
        vi.spyOn(
            service as unknown as { _afterHardDelete: () => void },
            '_afterHardDelete'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.hardDelete(actorWithPerm, eventId);
        expectInternalError(result);
    });
});
