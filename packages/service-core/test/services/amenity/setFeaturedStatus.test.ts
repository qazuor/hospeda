import { AmenityModel } from '@repo/db';
import { AmenitiesTypeEnum, type AmenityType, PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.setFeaturedStatus', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const amenity = AmenityFactoryBuilder.create({
        name: 'Test Amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
        isFeatured: false
    });
    const featuredAmenity = { ...amenity, isFeatured: true };

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should set isFeatured to true (success)', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue(featuredAmenity);
        const result = await service.setFeaturedStatus({
            actor,
            id: amenity.id,
            isFeatured: true
        });
        expectSuccess(result);
        expect(result.data?.updated).toBe(true);
    });

    it('should set isFeatured to false (success)', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(featuredAmenity);
        asMock(amenityModelMock.update).mockResolvedValue(amenity);
        const result = await service.setFeaturedStatus({
            actor,
            id: amenity.id,
            isFeatured: false
        });
        expectSuccess(result);
        expect(result.data?.updated).toBe(true);
    });

    it('should return NOT_FOUND if amenity does not exist', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(undefined);
        const result = await service.setFeaturedStatus({
            actor,
            id: 'nonexistent-id' as AmenityType['id'],
            isFeatured: true
        });
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const forbiddenActor = createActor({ permissions: [] });
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        const result = await service.setFeaturedStatus({
            actor: forbiddenActor,
            id: amenity.id,
            isFeatured: true
        });
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.setFeaturedStatus({
            actor,
            id: amenity.id,
            isFeatured: true
        });
        expectInternalError(result);
    });

    it('should return updated: false if isFeatured is already the requested value', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(featuredAmenity);
        // No update should be called
        const result = await service.setFeaturedStatus({
            actor,
            id: featuredAmenity.id,
            isFeatured: true
        });
        expectSuccess(result);
        expect(result.data?.updated).toBe(false);
    });
});
