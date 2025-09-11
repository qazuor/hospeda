import { AmenityModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmenityService } from '../../../src/services/amenity/amenity.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AmenityService.count', () => {
    let service: AmenityService;
    let amenityModelMock: AmenityModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const countParams = {
        filters: { nameContains: 'Test Amenity' },
        searchInDescription: false,
        fuzzySearch: false
    };

    beforeEach(() => {
        amenityModelMock = createTypedModelMock(AmenityModel, ['count']);
        loggerMock = createLoggerMock();
        service = new AmenityService({ logger: loggerMock }, amenityModelMock);
        actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_FEATURES_EDIT] });
    });

    it('should return the count of amenities (success)', async () => {
        asMock(amenityModelMock.count).mockResolvedValue(1);
        const result = await service.count(actor, countParams);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should succeed even if actor lacks ACCOMMODATION_FEATURES_EDIT permission (public count)', async () => {
        actor = createActor({ permissions: [] });
        asMock(amenityModelMock.count).mockResolvedValue(1);
        const result = await service.count(actor, countParams);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(amenityModelMock.count).mockRejectedValue(new Error('DB error'));
        const result = await service.count(actor, countParams);
        expectInternalError(result);
    });
});
