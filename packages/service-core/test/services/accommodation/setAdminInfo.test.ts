import { AccommodationModel } from '@repo/db';
import type { Accommodation, AdminInfoType } from '@repo/schemas';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createAccommodation, getMockAccommodationId } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectNotFoundError,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

type Actor = ReturnType<typeof createActor>;
let modelMock: AccommodationModel;
let loggerMock: ReturnType<typeof createLoggerMock>;

function asMock(fn: unknown) {
    return fn as import('vitest').MockInstance;
}

describe('AccommodationService - setAdminInfo', () => {
    let service: AccommodationService;
    let superAdmin: Actor;
    let entity: Accommodation;

    beforeEach(() => {
        modelMock = createTypedModelMock(AccommodationModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new AccommodationService({ logger: loggerMock }, modelMock);
        superAdmin = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        entity = createAccommodation();
        asMock(modelMock.findById).mockResolvedValue(entity);
        asMock(modelMock.update).mockResolvedValue({ ...entity, adminInfo: { favorite: true } });
    });

    it('should return FORBIDDEN if user has no permission', async () => {
        const forbiddenAccommodation = createAccommodation({
            id: getMockAccommodationId('acc-entity-id')
        });
        const forbiddenActor = createActor({
            id: getMockId('user', 'actor-id-different'),
            role: RoleEnum.USER,
            permissions: []
        });
        asMock(modelMock.findById).mockResolvedValue(forbiddenAccommodation);
        const result = await service.setAdminInfo({
            actor: forbiddenActor,
            id: forbiddenAccommodation.id,
            adminInfo: { favorite: true }
        });
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(undefined);
        const result = await service.setAdminInfo({
            actor: superAdmin,
            id: getMockAccommodationId('not-exist'),
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
