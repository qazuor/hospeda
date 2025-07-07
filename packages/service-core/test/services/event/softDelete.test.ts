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
 * Test suite for EventService.softDelete
 */
describe('EventService.softDelete', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_DELETE] });
    const actorNoPerm = createUser();
    const existingEvent = createMockEvent({
        visibility: VisibilityEnum.PUBLIC,
        deletedAt: undefined
    });
    const eventId = existingEvent.id;

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should soft delete an event (success)', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.softDelete as Mock).mockResolvedValue(1);
        const result = await service.softDelete(actorWithPerm, eventId);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
        expect(modelMock.softDelete as Mock).toHaveBeenCalledWith({ id: eventId });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        const result = await service.softDelete(actorNoPerm, eventId);
        expectForbiddenError(result);
        expect(modelMock.softDelete as Mock).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        (modelMock.findById as Mock).mockResolvedValue(null);
        const result = await service.softDelete(actorWithPerm, eventId);
        expectNotFoundError(result);
    });

    it('should return count 0 if event is already deleted', async () => {
        const deletedEvent = { ...existingEvent, deletedAt: new Date() };
        (modelMock.findById as Mock).mockResolvedValue(deletedEvent);
        const result = await service.softDelete(actorWithPerm, eventId);
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
        expect(modelMock.softDelete as Mock).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if model.softDelete throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.softDelete as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.softDelete(actorWithPerm, eventId);
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _beforeSoftDelete throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        vi.spyOn(
            service as unknown as { _beforeSoftDelete: () => void },
            '_beforeSoftDelete'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.softDelete(actorWithPerm, eventId);
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterSoftDelete throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.softDelete as Mock).mockResolvedValue(1);
        vi.spyOn(
            service as unknown as { _afterSoftDelete: () => void },
            '_afterSoftDelete'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.softDelete(actorWithPerm, eventId);
        expectInternalError(result);
    });
});
