import { AmenityModel } from '@repo/db';
import { AmenitiesTypeEnum, PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.setAdminInfo', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const adminInfo = { notes: 'test', favorite: false };
    const newAdminInfo = { notes: 'updated', favorite: true };
    const amenity = AmenityFactoryBuilder.create({
        name: 'Test Amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
        adminInfo
    });

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should set admin info for an amenity (success)', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue({ ...amenity, adminInfo: newAdminInfo });
        const result = await service.setAdminInfo({
            actor,
            id: amenity.id,
            adminInfo: newAdminInfo
        });
        expectSuccess(result);
        expect(result.data?.adminInfo).toEqual(newAdminInfo);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockRejectedValue(new Error('DB error'));
        const result = await service.setAdminInfo({
            actor,
            id: amenity.id,
            adminInfo: newAdminInfo
        });
        expectInternalError(result);
    });
});
