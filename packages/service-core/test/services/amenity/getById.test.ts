import { AmenityModel } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.getById', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const amenity = AmenityFactoryBuilder.create({ name: 'Test Amenity' });

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [] });
    });

    it('should return an amenity by id (success)', async () => {
        asMock(amenityModelMock.findOne).mockResolvedValue(amenity);
        const result = await service.getById(actor, amenity.id);
        expectSuccess(result);
        expect(result.data).toEqual(amenity);
    });

    it('should return NOT_FOUND error if amenity does not exist', async () => {
        asMock(amenityModelMock.findOne).mockResolvedValue(null);
        const result = await service.getById(actor, amenity.id);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, amenity.id);
        expectInternalError(result);
    });
});
