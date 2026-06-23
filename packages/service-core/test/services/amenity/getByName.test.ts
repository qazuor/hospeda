import { AmenityModel } from '@repo/db';
import { AmenitiesTypeEnum } from '@repo/schemas';
import { beforeEach, describe, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.getByName', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const amenity = AmenityFactoryBuilder.create({
        slug: 'test-amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES
    });

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [] });
    });

    it('should return an amenity by slug (success)', async () => {
        asMock(amenityModelMock.findOne).mockResolvedValue(amenity);
        // getByName looks up by the 'name' field — with name dropped, it falls back to
        // querying by any string field. The base implementation calls getByField('name', slug).
        const result = await service.getByName(actor, amenity.slug ?? 'test-amenity');
        expectSuccess(result);
    });

    it('should return NOT_FOUND error if amenity does not exist', async () => {
        asMock(amenityModelMock.findOne).mockResolvedValue(null);
        const result = await service.getByName(actor, amenity.slug ?? 'test-amenity');
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.getByName(actor, amenity.slug ?? 'test-amenity');
        expectInternalError(result);
    });
});
