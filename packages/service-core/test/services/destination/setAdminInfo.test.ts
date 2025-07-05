import { DestinationModel } from '@repo/db';
import { type AdminInfoType, type DestinationType, PermissionEnum, RoleEnum } from '@repo/types';
import { beforeEach, describe, it } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor } from '../../factories/actorFactory';
import { createDestination, getMockDestinationId } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectNotFoundError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

type Actor = ReturnType<typeof createActor>;
let modelMock: DestinationModel;
let loggerMock: ReturnType<typeof createLoggerMock>;

function asMock(fn: unknown) {
    return fn as import('vitest').MockInstance;
}

describe('DestinationService - setAdminInfo', () => {
    let service: DestinationService;
    let superAdmin: Actor;
    let entity: DestinationType;

    beforeEach(() => {
        modelMock = createTypedModelMock(DestinationModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new DestinationService({ logger: loggerMock }, modelMock);
        superAdmin = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.DESTINATION_UPDATE]
        });
        entity = createDestination();
        asMock(modelMock.findById).mockResolvedValue(entity);
        asMock(modelMock.update).mockResolvedValue({ ...entity, adminInfo: { favorite: true } });
    });

    it('should return FORBIDDEN if user has no permission', async () => {
        const forbiddenDestination = createDestination({
            id: getMockDestinationId('dest-entity-id')
        });
        const forbiddenActor = createActor({
            id: getMockId('user', 'actor-id-different'),
            role: RoleEnum.USER,
            permissions: []
        });
        asMock(modelMock.findById).mockResolvedValue(forbiddenDestination);
        const result = await service.setAdminInfo({
            actor: forbiddenActor,
            id: forbiddenDestination.id,
            adminInfo: { favorite: true }
        });
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(undefined);
        const result = await service.setAdminInfo({
            actor: superAdmin,
            id: getMockDestinationId('not-exist'),
            adminInfo: { favorite: true }
        });
        expectNotFoundError(result);
    });

    it('should return VALIDATION_ERROR for invalid adminInfo', async () => {
        asMock(modelMock.findById).mockResolvedValue(entity);
        const result = await service.setAdminInfo({
            actor: superAdmin,
            id: entity.id,
            adminInfo: {} as AdminInfoType
        });
        expectValidationError(result);
    });
});
