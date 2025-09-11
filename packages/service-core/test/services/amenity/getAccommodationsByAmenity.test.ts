import type { AccommodationModel, AmenityModel, RAccommodationAmenityModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AmenityService,
    type ServiceOutputAccommodations
} from '../../../src/services/amenity/amenity.service';
import {
    getMockAccommodationId,
    getMockAmenityId
} from '../../../test/factories/accommodationFactory';
import { createActor } from '../../../test/factories/actorFactory';
import { AmenityFactoryBuilder } from '../../../test/factories/amenityFactory';
import { createLoggerMock, createModelMock } from '../../../test/utils/modelMockFactory';

/**
 * Test suite for AmenityService.getAccommodationsByAmenity
 *
 * This suite covers:
 * - Retrieving accommodations for a given amenity (happy path)
 * - Handling of empty results
 * - Handling of missing amenity
 * - Permission checks
 * - Input validation errors
 */
describe('AmenityService.getAccommodationsByAmenity', () => {
    let service: AmenityService;
    const logger = createLoggerMock();
    const ctx = { logger };

    const amenityId = getMockAmenityId('am-1');
    const actorWithPerms = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
    });
    const actorNoPerms = createActor({ role: RoleEnum.GUEST, permissions: [] });
    const amenity = AmenityFactoryBuilder.create({ id: amenityId });
    const accommodation = { id: getMockAccommodationId('acc-1'), name: 'Test Accommodation' };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('should return accommodations for a given amenity (happy path)', async () => {
        const model = createModelMock();
        service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockResolvedValueOnce(amenity);
        (model.findAll as Mock).mockResolvedValueOnce({
            items: [{ accommodationId: accommodation.id }]
        });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [accommodation] });

        const result = (await service.getAccommodationsByAmenity(actorWithPerms, {
            amenityId
        })) as ServiceOutputAccommodations;

        expect(result.data).toHaveProperty('accommodations');
        expect(Array.isArray(result.data?.accommodations)).toBe(true);
        expect(result.data?.accommodations[0]).toEqual(accommodation);
    });

    it('should return empty array if no accommodations found', async () => {
        const model = createModelMock();
        service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockResolvedValueOnce(amenity);
        (model.findAll as Mock).mockResolvedValueOnce({ items: [] });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [] });

        const result = (await service.getAccommodationsByAmenity(actorWithPerms, {
            amenityId
        })) as ServiceOutputAccommodations;

        expect(result.data).toHaveProperty('accommodations');
        expect(result.data?.accommodations).toHaveLength(0);
    });

    it('should return NOT_FOUND if amenity does not exist', async () => {
        const model = createModelMock();
        service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockResolvedValueOnce(null);

        const result = (await service.getAccommodationsByAmenity(actorWithPerms, {
            amenityId
        })) as ServiceOutputAccommodations;

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const model = createModelMock();
        service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel,
            model as unknown as AccommodationModel
        );
        (model.findOne as Mock).mockResolvedValueOnce(amenity);
        (model.findAll as Mock).mockResolvedValueOnce({
            items: [{ accommodationId: accommodation.id }]
        });
        (model.findAll as Mock).mockResolvedValueOnce({ items: [accommodation] });

        const result = (await service.getAccommodationsByAmenity(actorNoPerms, {
            amenityId
        })) as ServiceOutputAccommodations;

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return validation error for invalid input', async () => {
        const model = createModelMock();
        service = new AmenityService(
            ctx,
            model as unknown as AmenityModel,
            model as unknown as RAccommodationAmenityModel,
            model as unknown as AccommodationModel
        );
        const invalidAmenityId = '';

        const result = (await service.getAccommodationsByAmenity(actorWithPerms, {
            amenityId: invalidAmenityId as any
        })) as ServiceOutputAccommodations;
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
