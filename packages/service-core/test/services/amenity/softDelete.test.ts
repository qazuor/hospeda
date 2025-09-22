import { AmenityModel } from '@repo/db';
import { AmenitiesTypeEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.softDelete', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const amenity = AmenityFactoryBuilder.create({
        name: 'Test Amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES
    });

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should soft delete an amenity (success)', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.softDelete).mockResolvedValue(1);
        const result = await service.softDelete(actor, amenity.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return FORBIDDEN if actor lacks ACCOMMODATION_FEATURES_EDIT permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        const result = await service.softDelete(actor, amenity.id);
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if amenity does not exist', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(null);
        const result = await service.softDelete(actor, amenity.id);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.softDelete(actor, amenity.id);
        expectInternalError(result);
    });

    it('should not restore an amenity that is not soft-deleted', async () => {
        const notDeletedAmenity = AmenityFactoryBuilder.create({ deletedAt: undefined });
        asMock(amenityModelMock.findById).mockResolvedValue(notDeletedAmenity);
        asMock(amenityModelMock.restore).mockResolvedValue(0);
        const result = await service.restore(actor, notDeletedAmenity.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });

    it('should not soft delete an amenity that is already deleted', async () => {
        const alreadyDeletedAmenity = AmenityFactoryBuilder.create({ deletedAt: new Date() });
        asMock(amenityModelMock.findById).mockResolvedValue(alreadyDeletedAmenity);
        asMock(amenityModelMock.softDelete).mockResolvedValue(0);
        const result = await service.softDelete(actor, alreadyDeletedAmenity.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });
});
