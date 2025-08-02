import { AmenityModel } from '@repo/db';
import { AmenitiesTypeEnum, PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.restore', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const amenity = AmenityFactoryBuilder.create({
        name: 'Test Amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
        deletedAt: new Date()
    });

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findById', 'restore']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should restore a soft-deleted amenity (success)', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.restore).mockResolvedValue(1);
        const result = await service.restore(actor, amenity.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return FORBIDDEN if actor lacks ACCOMMODATION_FEATURES_EDIT permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        const result = await service.restore(actor, amenity.id);
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if amenity does not exist', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(null);
        const result = await service.restore(actor, amenity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.restore(actor, amenity.id);
        expectInternalError(result);
    });
});
