import { AmenityModel } from '@repo/db';
import { AmenitiesTypeEnum, PermissionEnum } from '@repo/schemas';
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
        slug: 'test-amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
        icon: '🛏️',
        description: {
            es: 'A test amenity desc',
            en: 'A test amenity desc',
            pt: 'A test amenity desc'
        },
        applicableVerticals: ['accommodation'] as ('gastronomy' | 'experience' | 'accommodation')[],
        isFeatured: false,
        lifecycleState: 'ACTIVE' as any,
        isBuiltin: false,
        displayWeight: 50
    };
    const createdAmenity = AmenityFactoryBuilder.create({
        ...input,
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES
    });

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['create', 'findOne']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.AMENITY_CREATE] });
    });

    it('should create an amenity (success)', async () => {
        asMock(amenityModelMock.findOne).mockResolvedValue(null); // uniqueness
        asMock(amenityModelMock.create).mockResolvedValue(createdAmenity);
        const result = await service.create(actor, input);
        expectSuccess(result);
        expect(result.data).toMatchObject(input);
    });

    it('should return FORBIDDEN if actor lacks AMENITY_CREATE permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.create(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // empty slug violates min:3
        const result = await service.create(actor, {
            ...input,
            slug: ''
        });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, input);
        expectInternalError(result);
    });

    it('should create with a unique slug', async () => {
        asMock(amenityModelMock.findOne)
            .mockResolvedValueOnce(null) // first slug is unique
            .mockResolvedValueOnce({ ...createdAmenity, slug: 'test-amenity' }) // second slug exists
            .mockResolvedValueOnce(null); // unique after suffix
        asMock(amenityModelMock.create).mockResolvedValueOnce(createdAmenity);
        asMock(amenityModelMock.create).mockResolvedValueOnce({
            ...createdAmenity,
            slug: 'test-amenity-2'
        });
        // First creation — slug matches input
        const result1 = await service.create(actor, input);
        expectSuccess(result1);
        expect(result1.data?.slug).toBe('test-amenity');
        // Second creation with same slug — model returns a suffixed slug
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
            slug: 'minimal-amenity',
            type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
            applicableVerticals: ['accommodation'] as (
                | 'gastronomy'
                | 'experience'
                | 'accommodation'
            )[],
            isFeatured: false,
            lifecycleState: 'ACTIVE' as any,
            isBuiltin: false,
            displayWeight: 50
        };
        const result = await service.create(actor, minimalInput);
        expectSuccess(result);
        expect(result.data?.icon).toBeUndefined();
        expect(result.data?.description).toBeUndefined();
    });

    it('should reject too-short slug (below min:3)', async () => {
        // slug min is 3 characters
        const result = await service.create(actor, { ...input, slug: 'ab' });
        expectValidationError(result);
    });
});
