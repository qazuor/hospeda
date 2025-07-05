import { AccommodationModel } from '@repo/db';
import { type AccommodationType, PermissionEnum, RoleEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createAccommodation, getMockAccommodationId } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

type Actor = ReturnType<typeof createActor>;
let modelMock: AccommodationModel;
let loggerMock: ReturnType<typeof createLoggerMock>;

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

describe('AccommodationService - getAdminInfo', () => {
    let service: AccommodationService;
    let admin: Actor;
    let accommodation: AccommodationType;

    beforeEach(() => {
        modelMock = createTypedModelMock(AccommodationModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new AccommodationService({ logger: loggerMock }, modelMock);
        admin = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        accommodation = createAccommodation();
        asMock(modelMock.findById).mockResolvedValue(accommodation);
    });

    it('should get adminInfo for admin', async () => {
        const result = await service.getAdminInfo({
            actor: admin,
            id: accommodation.id
        });
        expectSuccess(result);
        expect(result.data?.adminInfo).toEqual(accommodation.adminInfo);
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
        const result = await service.getAdminInfo({
            actor: forbiddenActor,
            id: forbiddenAccommodation.id
        });
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        asMock(modelMock.findById).mockResolvedValue(undefined);
        const result = await service.getAdminInfo({
            actor: admin,
            id: getMockAccommodationId('not-exist')
        });
        expectNotFoundError(result);
    });
});
