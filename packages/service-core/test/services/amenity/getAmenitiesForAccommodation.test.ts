import type { AmenityModel, RAccommodationAmenityModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AmenityService,
    type ServiceOutputAmenities
} from '../../../src/services/amenity/amenity.service';
import {
    getMockAccommodationId,
    getMockAmenityId
} from '../../../test/factories/accommodationFactory';
import { createActor } from '../../../test/factories/actorFactory';
import { AmenityFactoryBuilder } from '../../../test/factories/amenityFactory';
import { createLoggerMock, createModelMock } from '../../../test/utils/modelMockFactory';

/**
 * Test suite for AmenityService.getAmenitiesForAccommodation
 *
 * This suite covers:
 * - Retrieving amenities for a given accommodation (happy path)
 * - Handling of empty results
 * - Permission checks
 * - Input validation errors
 */
describe('AmenityService.getAmenitiesForAccommodation', () => {
    const logger = createLoggerMock();
    const ctx = { logger };

    const accommodationId = getMockAccommodationId('acc-1');
    const actorWithPerms = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
    });
    const actorNoPerms = createActor({ role: RoleEnum.GUEST, permissions: [] });
    const amenity = AmenityFactoryBuilder.create({ id: getMockAmenityId('am-1') });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('should return amenities for a given accommodation (happy path)', async () => {
        const model = createModelMock();
        const service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel
        );
        (model.findAll as Mock).mockResolvedValueOnce({ items: [{ amenityId: amenity.id }] });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [amenity] });

        const result = (await service.getAmenitiesForAccommodation(actorWithPerms, {
            accommodationId
        })) as ServiceOutputAmenities;

        expect(result.data).toHaveProperty('amenities');
        expect(Array.isArray(result.data?.amenities)).toBe(true);
        expect(result.data?.amenities[0]).toEqual(amenity);
    });

    it('should return empty array if no amenities found', async () => {
        const model = createModelMock();
        const service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel
        );
        (model.findAll as Mock).mockResolvedValueOnce({ items: [] });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [] });

        const result = (await service.getAmenitiesForAccommodation(actorWithPerms, {
            accommodationId
        })) as ServiceOutputAmenities;

        expect(result.data).toHaveProperty('amenities');
        expect(result.data?.amenities).toHaveLength(0);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const model = createModelMock();
        const service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel
        );
        (model.findAll as Mock).mockResolvedValueOnce({ items: [{ amenityId: amenity.id }] });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [amenity] });

        const result = (await service.getAmenitiesForAccommodation(actorNoPerms, {
            accommodationId
        })) as ServiceOutputAmenities;

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return validation error for invalid input', async () => {
        const model = createModelMock();
        const service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel
        );
        const invalidAccommodationId = '';

        const result = (await service.getAmenitiesForAccommodation(actorWithPerms, {
            accommodationId: invalidAccommodationId
        })) as ServiceOutputAmenities;
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
