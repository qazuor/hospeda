import { AmenityModel } from '@repo/db';
import { AmenitiesTypeEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AmenityFactoryBuilder } from '../../factories/amenityFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.search', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const amenity = AmenityFactoryBuilder.create({
        name: 'Test Amenity',
        type: AmenitiesTypeEnum.GENERAL_APPLIANCES
    });
    const paginated = { items: [amenity], total: 1 };
    const searchParams = {
        page: 1,
        pageSize: 10,
        filters: { nameContains: 'Test Amenity' },
        searchInDescription: false,
        fuzzySearch: false
    };

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should return a paginated list of amenities (success)', async () => {
        asMock(amenityModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.search(actor, searchParams);
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    it('should succeed even if actor lacks ACCOMMODATION_FEATURES_EDIT permission (public search)', async () => {
        actor = createActor({ permissions: [] });
        asMock(amenityModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.search(actor, searchParams);
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.search(actor, searchParams);
        expectInternalError(result);
    });
});
