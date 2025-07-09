import { AmenityModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { AmenitiesTypeEnum } from '@repo/types/enums/amenity-type.enum';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.create', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const input = {
        name: 'Test Amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES as unknown as string,
        icon: '🛏️',
        description: 'A test amenity',
        isFeatured: false
    };
    const createdAmenity = AmenityFactoryBuilder.create({
        ...input,
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES
    });

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['create', 'findOne']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should create an amenity (success)', async () => {
        asMock(amenityModelMock.findOne).mockResolvedValue(null); // uniqueness
        asMock(amenityModelMock.create).mockResolvedValue(createdAmenity);
        const result = await service.create(actor, input);
        expectSuccess(result);
        expect(result.data).toMatchObject(input);
    });

    it('should return FORBIDDEN if actor lacks ACCOMMODATION_FEATURES_EDIT permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.create(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // name empty
        const result = await service.create(actor, {
            ...input,
            name: ''
        });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, input);
        expectInternalError(result);
    });

    it('should generate a unique slug if name is duplicated', async () => {
        asMock(amenityModelMock.findOne)
            .mockResolvedValueOnce(null) // first slug is unique
            .mockResolvedValueOnce({ ...createdAmenity, slug: 'test-amenity' }) // second slug exists
            .mockResolvedValueOnce(null); // unique after suffix
        asMock(amenityModelMock.create).mockResolvedValueOnce(createdAmenity);
        asMock(amenityModelMock.create).mockResolvedValueOnce({
            ...createdAmenity,
            slug: 'test-amenity-2'
        });
        // First creation
        const result1 = await service.create(actor, input);
        expectSuccess(result1);
        expect(result1.data?.slug).toBe('test-amenity');
        // Second creation with same name
        const result2 = await service.create(actor, input);
        expectSuccess(result2);
        expect(result2.data?.slug).toMatch(/^test-amenity(-\d+)?$/);
        expect(result2.data?.slug).not.toBe(result1.data?.slug);
    });

    it('should allow omitting optional fields', async () => {
        asMock(amenityModelMock.findOne).mockResolvedValue(null);
        asMock(amenityModelMock.create).mockResolvedValue({
            ...createdAmenity,
            icon: undefined,
            description: undefined
        });
        const minimalInput = {
            name: 'Minimal Amenity',
            type: AmenitiesTypeEnum.GENERAL_APPLIANCES as unknown as string,
            isFeatured: false
        };
        const result = await service.create(actor, minimalInput);
        expectSuccess(result);
        expect(result.data?.icon).toBeUndefined();
        expect(result.data?.description).toBeUndefined();
    });

    it('should reject null for required fields', async () => {
        // name is required
        // @ts-expect-error
        const result = await service.create(actor, { ...input, name: null });
        expectValidationError(result);
    });
});
