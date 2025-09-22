import { EventModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
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
import { asMock } from '../../utils/test-utils';

/**
 * Test suite for EventService.restore
 */
describe('EventService.restore', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_RESTORE] });
    const actorNoPerm = createUser();
    const eventId = getMockEventId('event-1');

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findById', 'restore']);
        loggerMock = createLoggerMock();
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should restore an event (success, deleted)', async () => {
        const deletedEvent = createMockEvent({ id: eventId, deletedAt: new Date() });
        asMock(modelMock.findById).mockResolvedValue(deletedEvent);
        asMock(modelMock.restore).mockResolvedValue(1);
        const result = await service.restore(actorWithPerm, eventId);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
        expect(modelMock.restore as Mock).toHaveBeenCalledWith({ id: eventId });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const deletedEvent = createMockEvent({ id: eventId, deletedAt: new Date() });
        asMock(modelMock.findById).mockResolvedValue(deletedEvent);
        const result = await service.restore(actorNoPerm, eventId);
        expectForbiddenError(result);
        expect(modelMock.restore as Mock).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(null);
        const result = await service.restore(actorWithPerm, eventId);
        expectNotFoundError(result);
    });

    it('should return count 0 if event is not deleted', async () => {
        const notDeletedEvent = createMockEvent({ id: eventId, deletedAt: undefined });
        asMock(modelMock.findById).mockResolvedValue(notDeletedEvent);
        const result = await service.restore(actorWithPerm, eventId);
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
        expect(modelMock.restore as Mock).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if model.restore throws', async () => {
        const deletedEvent = createMockEvent({ id: eventId, deletedAt: new Date() });
        asMock(modelMock.findById).mockResolvedValue(deletedEvent);
        asMock(modelMock.restore).mockRejectedValue(new Error('DB error'));
        const result = await service.restore(actorWithPerm, eventId);
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _beforeRestore throws', async () => {
        const deletedEvent = createMockEvent({ id: eventId, deletedAt: new Date() });
        asMock(modelMock.findById).mockResolvedValue(deletedEvent);
        vi.spyOn(
            service as unknown as { _beforeRestore: () => void },
            '_beforeRestore'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.restore(actorWithPerm, eventId);
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterRestore throws', async () => {
        const deletedEvent = createMockEvent({ id: eventId, deletedAt: new Date() });
        asMock(modelMock.findById).mockResolvedValue(deletedEvent);
        asMock(modelMock.restore).mockResolvedValue(1);
        vi.spyOn(
            service as unknown as { _afterRestore: () => void },
            '_afterRestore'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.restore(actorWithPerm, eventId);
        expectInternalError(result);
    });
});
