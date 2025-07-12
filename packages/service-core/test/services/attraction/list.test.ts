import { AttractionModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AttractionService.list', () => {
    let service: AttractionService;
    let attractionModelMock: AttractionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const attraction = AttractionFactoryBuilder.create({ name: 'Test Attraction' });
    const paginated = { items: [attraction], total: 1 };

    beforeEach(() => {
        attractionModelMock = createTypedModelMock(AttractionModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new AttractionService({ logger: loggerMock }, attractionModelMock);
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
    });

    it('should return a paginated list of attractions (success)', async () => {
        asMock(attractionModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.list(actor, {});
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    it('should succeed even if actor lacks permissions (public list)', async () => {
        actor = createActor({ permissions: [] });
        asMock(attractionModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.list(actor, {});
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(attractionModelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.list(actor, {});
        expectInternalError(result);
    });
});
