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
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES,
        icon: '🛏️',
        description: 'A test amenity'
    };
    const createdAmenity = AmenityFactoryBuilder.create(input);

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
});
