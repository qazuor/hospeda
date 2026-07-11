import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import type { PointOfInterestIdType } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const pointOfInterestId = getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType;
const actorWithPerms = createActor({ permissions: [] });

const pointOfInterest = { id: pointOfInterestId, slug: 'test-poi' };
const destination1 = { id: getMockId('destination', 'dest-1') };
const destination2 = { id: getMockId('destination', 'dest-2') };
const relation1 = { destinationId: destination1.id, pointOfInterestId };
const relation2 = { destinationId: destination2.id, pointOfInterestId };

describe('PointOfInterestService.getDestinationsByPointOfInterest', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let relatedModel: RDestinationPointOfInterestModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, ['findOne']);
        relatedModel = createTypedModelMock(RDestinationPointOfInterestModel, ['findAll']);
        destinationModel = createTypedModelMock(DestinationModel, ['findAll']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should return destinations for a point of interest (success, M2M case)', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(relatedModel.findAll).mockResolvedValue({ items: [relation1, relation2] });
        asMock(destinationModel.findAll).mockResolvedValue({ items: [destination1, destination2] });
        const result = await service.getDestinationsByPointOfInterest(actorWithPerms, {
            pointOfInterestId,
            page: 1,
            pageSize: 10
        });
        expect(result.data?.destinations).toEqual([destination1, destination2]);
        expect(result.error).toBeUndefined();
    });

    it('should return NOT_FOUND if point of interest does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(null);
        const result = await service.getDestinationsByPointOfInterest(actorWithPerms, {
            pointOfInterestId,
            page: 1,
            pageSize: 10
        });
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return empty array if no relations exist', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(relatedModel.findAll).mockResolvedValue({ items: [] });
        asMock(destinationModel.findAll).mockResolvedValue({ items: [] });
        const result = await service.getDestinationsByPointOfInterest(actorWithPerms, {
            pointOfInterestId,
            page: 1,
            pageSize: 10
        });
        expect(result.data?.destinations).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(relatedModel.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.getDestinationsByPointOfInterest(actorWithPerms, {
            pointOfInterestId,
            page: 1,
            pageSize: 10
        });
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
