import { EventModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/types';
import { beforeEach, describe, it } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createActor } from '../../factories/actorFactory';
import { getMockEvent, getMockEventId } from '../../factories/eventFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectNotFoundError } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

// Helper to cast a function to a Vitest mock
function asMock(fn: unknown) {
    return fn as import('vitest').MockInstance;
}

type Actor = ReturnType<typeof createActor>;
let modelMock: EventModel;
let loggerMock: ReturnType<typeof createLoggerMock>;

describe('EventService - getAdminInfo', () => {
    let service: EventService;
    let superAdmin: Actor;

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findById']);
        loggerMock = createLoggerMock();
        service = new EventService(modelMock, loggerMock);
        superAdmin = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.EVENT_UPDATE]
        });
        asMock(modelMock.findById).mockResolvedValue(
            getMockEvent({ id: getMockEventId('event-entity-id') })
        );
    });

    it('should return FORBIDDEN if user has no permission', async () => {
        // Arrange: actor y event con IDs distintos
        const forbiddenEvent = getMockEvent({ id: getMockEventId('event-entity-id') });
        const forbiddenActor = createActor({
            id: getMockId('user', 'actor-id-different'),
            role: RoleEnum.USER,
            permissions: []
        });
        asMock(modelMock.findById).mockResolvedValue(forbiddenEvent);
        // Act
        const result = await service.getAdminInfo({
            actor: forbiddenActor,
            id: forbiddenEvent.id
        });
        // Assert
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(undefined);
        const result = await service.getAdminInfo({
            actor: superAdmin,
            id: getMockEventId('not-exist')
        });
        expectNotFoundError(result);
    });
});
