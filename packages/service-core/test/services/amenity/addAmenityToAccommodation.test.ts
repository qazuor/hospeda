import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import {
    getMockAccommodationId,
    getMockAmenityId
} from '../../../test/factories/accommodationFactory';
import { createActor } from '../../../test/factories/actorFactory';
import { AmenityFactoryBuilder } from '../../../test/factories/amenityFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// Import types for models
import type { AccommodationModel, AmenityModel, RAccommodationAmenityModel } from '@repo/db';

/**
 * Test suite for AmenityService.addAmenityToAccommodation
 *
 * This suite covers:
 * - Successful addition of an amenity to an accommodation
 * - Handling of missing amenity or accommodation
 * - Handling of already existing relations
 * - Permission checks
 * - Input validation errors
 */
describe('AmenityService.addAmenityToAccommodation', () => {
    let service: AmenityService;
    let amenityModel: ReturnType<typeof createModelMock>;
    let relatedModel: ReturnType<typeof createModelMock>;
    let accommodationModel: ReturnType<typeof createModelMock>;
    const logger = createLoggerMock();
    const ctx = { logger };

    const validInput = {
        accommodationId: getMockAccommodationId('acc-1'),
        amenityId: getMockAmenityId('am-1'),
        isOptional: false,
        additionalCost: undefined,
        additionalCostPercent: undefined
    };
    const actorWithPerms = createActor({
        permissions: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
    });
    const actorNoPerms = createActor({ permissions: [] });
    const amenity = AmenityFactoryBuilder.create({ id: validInput.amenityId });

    beforeEach(() => {
        amenityModel = createModelMock(['findOne']);
        relatedModel = createModelMock(['findOne', 'create']);
        accommodationModel = createModelMock(['findOne']);
        service = new AmenityService(
            ctx,
            amenityModel as unknown as AmenityModel,
            relatedModel as unknown as RAccommodationAmenityModel,
            accommodationModel as unknown as AccommodationModel
        );
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('should add an amenity to an accommodation (happy path)', async () => {
        // Arrange
        (amenityModel.findOne as Mock).mockResolvedValueOnce(amenity); // Amenity exists
        (accommodationModel.findOne as Mock).mockResolvedValueOnce({
            id: validInput.accommodationId
        }); // Accommodation exists
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null); // No existing relation
        (relatedModel.create as Mock).mockResolvedValueOnce({ ...validInput });

        // Act
        const result = await service.addAmenityToAccommodation(actorWithPerms, validInput);

        // Assert
        expect(result.data).toHaveProperty('relation');
        expect(relatedModel.create as Mock).toHaveBeenCalledWith({
            accommodationId: validInput.accommodationId,
            amenityId: validInput.amenityId,
            isOptional: false,
            additionalCost: undefined,
            additionalCostPercent: undefined
        });
    });

    it('should throw NOT_FOUND if amenity does not exist', async () => {
        // Arrange
        (amenityModel.findOne as Mock).mockResolvedValueOnce(null); // Amenity does not exist

        // Act
        const result = await service.addAmenityToAccommodation(actorWithPerms, validInput);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should throw ALREADY_EXISTS if relation already exists', async () => {
        // Arrange
        (amenityModel.findOne as Mock).mockResolvedValueOnce(amenity); // Amenity exists
        (accommodationModel.findOne as Mock).mockResolvedValueOnce({
            id: validInput.accommodationId
        }); // Accommodation exists
        (relatedModel.findOne as Mock).mockResolvedValueOnce({ ...validInput }); // Relation exists

        // Act
        const result = await service.addAmenityToAccommodation(actorWithPerms, validInput);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
    });

    it('should throw FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        (amenityModel.findOne as Mock).mockResolvedValueOnce(amenity); // Amenity exists
        (relatedModel.findOne as Mock).mockResolvedValueOnce(null); // No existing relation

        // Act
        const result = await service.addAmenityToAccommodation(actorNoPerms, validInput);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should throw validation error for invalid input', async () => {
        // Arrange
        const invalidInput = { ...validInput, accommodationId: '' };

        // Act & Assert
        const result = await service.addAmenityToAccommodation(actorWithPerms, invalidInput as any);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
