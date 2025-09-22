import { EventModel } from '@repo/db';
import { type AdminInfoType, PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, it } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createActor } from '../../factories/actorFactory';
import { getMockEvent, getMockEventId } from '../../factories/eventFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectNotFoundError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

type Actor = ReturnType<typeof createActor>;
let modelMock: EventModel;
let loggerMock: ReturnType<typeof createLoggerMock>;

function asMock(fn: unknown) {
    return fn as import('vitest').MockInstance;
}

describe('EventService - setAdminInfo', () => {
    let service: EventService;
    let superAdmin: Actor;

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new EventService({ model: modelMock, logger: loggerMock });
        superAdmin = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.EVENT_UPDATE]
        });
        asMock(modelMock.findById).mockResolvedValue(
            getMockEvent({ id: getMockEventId('event-entity-id') })
        );
        asMock(modelMock.update).mockResolvedValue({
            ...getMockEvent({ id: getMockEventId('event-entity-id') }),
            adminInfo: { favorite: true }
        });
    });

    it('should return FORBIDDEN if user has no permission', async () => {
        const forbiddenEvent = getMockEvent({ id: getMockEventId('event-entity-id') });
        const forbiddenActor = createActor({
            id: getMockId('user', 'actor-id-different'),
            role: RoleEnum.USER,
            permissions: []
        });
        asMock(modelMock.findById).mockResolvedValue(forbiddenEvent);
        const result = await service.setAdminInfo({
            actor: forbiddenActor,
            id: forbiddenEvent.id,
            adminInfo: { favorite: true }
        });
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(undefined);
        const result = await service.setAdminInfo({
            actor: superAdmin,
            id: getMockEventId('not-exist'),
            adminInfo: { favorite: true }
        });
        expectNotFoundError(result);
    });

    it('should return VALIDATION_ERROR for invalid adminInfo', async () => {
        const entity = getMockEvent({ id: getMockEventId('event-entity-id') });
        asMock(modelMock.findById).mockResolvedValue(entity);
        const result = await service.setAdminInfo({
            actor: superAdmin,
            id: entity.id,
            adminInfo: {} as AdminInfoType
        });
        expectValidationError(result);
    });
});
