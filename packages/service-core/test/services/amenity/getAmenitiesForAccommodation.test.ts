import type { AmenityModel, RAccommodationAmenityModel } from '@repo/db';
import type { AmenityListWrapper } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { ServiceOutput } from '../../../src/types';
import { getMockAccommodationId } from '../../../test/factories/accommodationFactory';
import { createActor } from '../../../test/factories/actorFactory';
import { AmenityFactoryBuilder, getMockAmenityId } from '../../../test/factories/amenityFactory';
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
        (model.findAllWithRelations as Mock).mockResolvedValueOnce({
            items: [{ amenityId: amenity.id, amenity }],
            total: 1
        });

        const result = (await service.getAmenitiesForAccommodation(actorWithPerms, {
            accommodationId,
            page: 1,
            pageSize: 10
        })) as ServiceOutput<AmenityListWrapper>;

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
        (model.findAllWithRelations as Mock).mockResolvedValueOnce({
            items: [],
            total: 0
        });

        const result = (await service.getAmenitiesForAccommodation(actorWithPerms, {
            accommodationId,
            page: 1,
            pageSize: 10
        })) as ServiceOutput<AmenityListWrapper>;

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
            accommodationId,
            page: 1,
            pageSize: 10
        })) as ServiceOutput<AmenityListWrapper>;

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
            accommodationId: invalidAccommodationId as any,
            page: 1,
            pageSize: 10
        })) as ServiceOutput<AmenityListWrapper>;
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return amenities sorted by displayWeight DESC', async () => {
        const model = createModelMock();
        const service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel
        );
        const amenityLow = AmenityFactoryBuilder.create({
            id: getMockAmenityId('am-low'),
            displayWeight: 10
        });
        const amenityMid = AmenityFactoryBuilder.create({
            id: getMockAmenityId('am-mid'),
            displayWeight: 50
        });
        const amenityHigh = AmenityFactoryBuilder.create({
            id: getMockAmenityId('am-high'),
            displayWeight: 90
        });

        // Return in random order - service should sort them
        (model.findAllWithRelations as Mock).mockResolvedValueOnce({
            items: [
                { amenityId: amenityMid.id, amenity: amenityMid },
                { amenityId: amenityLow.id, amenity: amenityLow },
                { amenityId: amenityHigh.id, amenity: amenityHigh }
            ],
            total: 3
        });

        const result = (await service.getAmenitiesForAccommodation(actorWithPerms, {
            accommodationId,
            page: 1,
            pageSize: 10
        })) as ServiceOutput<AmenityListWrapper>;

        const amenities = result.data?.amenities;
        expect(amenities).toHaveLength(3);
        expect(amenities?.[0]?.displayWeight).toBe(90);
        expect(amenities?.[1]?.displayWeight).toBe(50);
        expect(amenities?.[2]?.displayWeight).toBe(10);
    });

    it('should handle amenities with undefined displayWeight using default of 50', async () => {
        const model = createModelMock();
        const service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel
        );
        const amenityNoWeight = AmenityFactoryBuilder.create({ id: getMockAmenityId('am-no') });
        (amenityNoWeight as any).displayWeight = undefined;
        const amenityHigh = AmenityFactoryBuilder.create({
            id: getMockAmenityId('am-high'),
            displayWeight: 90
        });

        (model.findAllWithRelations as Mock).mockResolvedValueOnce({
            items: [
                { amenityId: amenityNoWeight.id, amenity: amenityNoWeight },
                { amenityId: amenityHigh.id, amenity: amenityHigh }
            ],
            total: 2
        });

        const result = (await service.getAmenitiesForAccommodation(actorWithPerms, {
            accommodationId,
            page: 1,
            pageSize: 10
        })) as ServiceOutput<AmenityListWrapper>;

        expect(result.data?.amenities).toHaveLength(2);
        // High weight (90) should be first, undefined defaults to 50
        expect(result.data?.amenities?.[0]?.displayWeight).toBe(90);
    });
});
