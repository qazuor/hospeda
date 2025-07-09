import { AmenityModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { AmenitiesTypeEnum } from '@repo/types/enums/amenity-type.enum';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.getAdminInfo', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const adminInfo = { notes: 'test', favorite: false };
    const amenity = AmenityFactoryBuilder.create({
        name: 'Test Amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
        adminInfo
    });

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findById']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should get admin info for an amenity (success)', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        const result = await service.getAdminInfo({ actor, id: amenity.id });
        expectSuccess(result);
        expect(result.data?.adminInfo).toEqual(adminInfo);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.getAdminInfo({ actor, id: amenity.id });
        expectInternalError(result);
    });
});
