import { AmenityModel } from '@repo/db';
import { AmenitiesTypeEnum, PermissionEnum, ServiceErrorCode } from '@repo/types';
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
        name: 'Test Amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES
    });
    const updateInput = { name: 'Updated Amenity' };

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should update an amenity (success)', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue({ ...amenity, ...updateInput });
        const result = await service.update(actor, amenity.id, updateInput);
        expectSuccess(result);
        expect(result.data).toMatchObject(updateInput);
    });

    it('should return FORBIDDEN if actor lacks ACCOMMODATION_FEATURES_EDIT permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        const result = await service.update(actor, amenity.id, updateInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // name empty
        const result = await service.update(actor, amenity.id, { ...updateInput, name: '' });
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
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue({ ...amenity, description: 'New desc' });
        const result = await service.update(actor, amenity.id, { description: 'New desc' });
        expectSuccess(result);
        expect(result.data?.description).toBe('New desc');
        expect(result.data?.name).toBe(amenity.name);
    });

    it('should reject null for required fields', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        // @ts-expect-error
        const result = await service.update(actor, amenity.id, { name: null });
        expectValidationError(result);
    });

    it('should allow omitting optional fields in update', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue({ ...amenity });
        const result = await service.update(actor, amenity.id, {});
        expectSuccess(result);
        expect(result.data?.name).toBe(amenity.name);
    });

    it('should update isFeatured only', async () => {
        asMock(amenityModelMock.findById).mockResolvedValue(amenity);
        asMock(amenityModelMock.update).mockResolvedValue({ ...amenity, isFeatured: true });
        const result = await service.update(actor, amenity.id, { isFeatured: true });
        expectSuccess(result);
        expect(result.data?.isFeatured).toBe(true);
    });
});
