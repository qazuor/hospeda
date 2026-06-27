import { AmenityModel } from '@repo/db';
import { AmenitiesTypeEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
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

describe('AmenityService.update', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const amenity = AmenityFactoryBuilder.create({
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES
    });
    const updateInput = {
        slug: 'updated-amenity'
    };

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.AMENITY_UPDATE] });
    });

    it('should update an amenity (success)', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue({ ...amenity, ...updateInput });
        const result = await service.update(actor, amenity.id, updateInput);
        expectSuccess(result);
        expect(result.data?.slug).toBe(updateInput.slug);
    });

    it('should return FORBIDDEN if actor lacks AMENITY_UPDATE permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        const result = await service.update(actor, amenity.id, updateInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // empty slug violates min:3
        const result = await service.update(actor, amenity.id, {
            slug: ''
        });
        expectValidationError(result);
    });

    it('should return NOT_FOUND if amenity does not exist', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(null);
        const result = await service.update(actor, 'nonexistent-id', updateInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, amenity.id, updateInput);
        expectInternalError(result);
    });

    it('should allow partial update (only description)', async () => {
        const newDescription = {
            es: 'Nueva descripción suficientemente larga',
            en: 'New description with enough characters',
            pt: 'Nova descrição com caracteres suficientes'
        };
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue({
            ...amenity,
            description: newDescription
        });
        const result = await service.update(actor, amenity.id, {
            description: newDescription
        });
        expectSuccess(result);
        expect(result.data?.description).toEqual(newDescription);
        expect(result.data?.slug).toEqual(amenity.slug);
    });

    it('should reject slug that is too short (below min:3)', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        const result = await service.update(actor, amenity.id, { slug: 'ab' });
        expectValidationError(result);
    });

    it('should allow omitting optional fields in update', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue({ ...amenity });
        const result = await service.update(actor, amenity.id, {});
        expectSuccess(result);
        expect(result.data?.slug).toEqual(amenity.slug);
    });

    it('should update isFeatured only', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue({ ...amenity, isFeatured: true });
        const result = await service.update(actor, amenity.id, { isFeatured: true });
        expectSuccess(result);
        expect(result.data?.isFeatured).toBe(true);
    });
});
