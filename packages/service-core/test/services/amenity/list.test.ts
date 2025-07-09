import { AmenityModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { AmenitiesTypeEnum } from '@repo/types/enums/amenity-type.enum';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.list', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const amenity = AmenityFactoryBuilder.create({
        name: 'Test Amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES
    });
    const paginated = { items: [amenity], total: 1 };

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should return a paginated list of amenities (success)', async () => {
        asMock(amenityModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.list(actor, {});
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    it('should succeed even if actor lacks ACCOMMODATION_FEATURES_EDIT permission (public list)', async () => {
        actor = createActor({ permissions: [] });
        asMock(amenityModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.list(actor, {});
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.list(actor, {});
        expectInternalError(result);
    });
});
