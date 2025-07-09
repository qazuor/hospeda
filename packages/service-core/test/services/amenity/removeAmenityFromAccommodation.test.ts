import type { AmenityModel, RAccommodationAmenityModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import {
    getMockAccommodationId,
    getMockAmenityId
} from '../../../test/factories/accommodationFactory';
import { createActor } from '../../../test/factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../../test/utils/modelMockFactory';

/**
 * Tests for AmenityService.removeAmenityFromAccommodation
 */
describe('AmenityService.removeAmenityFromAccommodation', () => {
    let service: AmenityService;
    let amenityModel: ReturnType<typeof createModelMock>;
    let relatedModel: ReturnType<typeof createModelMock>;
    let logger: ReturnType<typeof createLoggerMock>;

    const accommodationId = getMockAccommodationId('acc-1');
    const amenityId = getMockAmenityId('am-1');
    const actorWithPerms = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
    });
    const actorNoPerms = createActor({ permissions: [] });

    const mockRelation = {
        id: 'rel-1',
        accommodationId,
        amenityId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
    };
    const mockAmenity = { id: amenityId };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        amenityModel = createModelMock();
        relatedModel = createModelMock();
        logger = createLoggerMock();
        service = new AmenityService(
            { logger },
            amenityModel as unknown as AmenityModel,
            relatedModel as unknown as RAccommodationAmenityModel
        );
    });

    it('should remove an amenity from an accommodation (success)', async () => {
        (amenityModel.findOne as Mock).mockResolvedValueOnce(mockAmenity);
        (relatedModel.findOne as Mock).mockResolvedValueOnce(mockRelation);
        (relatedModel.softDelete as Mock).mockResolvedValueOnce({
            ...mockRelation,
            deletedAt: new Date()
        });

        const result = await service.removeAmenityFromAccommodation(actorWithPerms, {
            accommodationId,
            amenityId
        });

        expect(result.data).toHaveProperty('relation');
        expect(result.data?.relation.accommodationId).toBe(accommodationId);
        expect(result.data?.relation.amenityId).toBe(amenityId);
        expect(result.error).toBeUndefined();
    });

    it('should return NOT_FOUND if amenity does not exist', async () => {
        (amenityModel.findOne as Mock).mockResolvedValueOnce(null);

        const result = await service.removeAmenityFromAccommodation(actorWithPerms, {
            accommodationId,
            amenityId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return NOT_FOUND if relation does not exist', async () => {
        (amenityModel.findOne as Mock).mockResolvedValueOnce(mockAmenity);
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null);

        const result = await service.removeAmenityFromAccommodation(actorWithPerms, {
            accommodationId,
            amenityId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if softDelete fails', async () => {
        (amenityModel.findOne as Mock).mockResolvedValueOnce(mockAmenity);
        (relatedModel.findOne as Mock).mockResolvedValueOnce(mockRelation);
        (relatedModel.softDelete as Mock).mockResolvedValueOnce(null);

        const result = await service.removeAmenityFromAccommodation(actorWithPerms, {
            accommodationId,
            amenityId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (amenityModel.findOne as Mock).mockResolvedValueOnce(mockAmenity);
        (relatedModel.findOne as Mock).mockResolvedValueOnce(mockRelation);

        const result = await service.removeAmenityFromAccommodation(actorNoPerms, {
            accommodationId,
            amenityId
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Do not set up any mocks for amenityModel or relatedModel here
        const result = await service.removeAmenityFromAccommodation(actorWithPerms, {
            accommodationId: '',
            amenityId: ''
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
