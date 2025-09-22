import { AttractionModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AttractionService.count', () => {
    let service: AttractionService;
    let attractionModelMock: AttractionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const countParams = {
        page: 1,
        pageSize: 10,
        filters: { name: 'Test Attraction' }
    };

    beforeEach(() => {
        attractionModelMock = createTypedModelMock(AttractionModel, ['count']);
        loggerMock = createLoggerMock();
        service = new AttractionService({ logger: loggerMock }, attractionModelMock);
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
    });

    it('should return the count of attractions (success)', async () => {
        asMock(attractionModelMock.count).mockResolvedValue(1);
        const result = await service.count(actor, countParams);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should succeed even if actor lacks permissions (public count)', async () => {
        actor = createActor({ permissions: [] });
        asMock(attractionModelMock.count).mockResolvedValue(1);
        const result = await service.count(actor, countParams);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(attractionModelMock.count).mockRejectedValue(new Error('DB error'));
        const result = await service.count(actor, countParams);
        expectInternalError(result);
    });
});
