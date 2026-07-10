import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import type { DestinationIdType, PointOfInterestIdType } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;
const actorWithPerms = createActor({ permissions: [] });

const destination = { id: destinationId };
const poi1 = {
    id: getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType,
    slug: 'test-poi-1'
};
const poi2 = {
    id: getMockId('pointOfInterest', 'poi-2') as PointOfInterestIdType,
    slug: 'test-poi-2'
};
const relation1 = { destinationId, pointOfInterestId: poi1.id };
const relation2 = { destinationId, pointOfInterestId: poi2.id };

describe('PointOfInterestService.getPointsOfInterestForDestination', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let relatedModel: RDestinationPointOfInterestModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, ['findAll', 'findOne']);
        relatedModel = createTypedModelMock(RDestinationPointOfInterestModel, ['findAll']);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should return points of interest for a destination (success)', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findAll).mockResolvedValue({ items: [relation1, relation2] });
        asMock(model.findAll).mockResolvedValue({ items: [poi1, poi2] });
        const result = await service.getPointsOfInterestForDestination(actorWithPerms, {
            destinationId,
            page: 1,
            pageSize: 10
        });
        expect(result.data?.pointsOfInterest).toEqual([poi1, poi2]);
        expect(result.error).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(null);
        const result = await service.getPointsOfInterestForDestination(actorWithPerms, {
            destinationId,
            page: 1,
            pageSize: 10
        });
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return empty array if no relations exist', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findAll).mockResolvedValue({ items: [] });
        asMock(model.findAll).mockResolvedValue({ items: [] });
        const result = await service.getPointsOfInterestForDestination(actorWithPerms, {
            destinationId,
            page: 1,
            pageSize: 10
        });
        expect(result.data?.pointsOfInterest).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('should return points of interest sorted by displayWeight DESC', async () => {
        const poiLow = {
            id: getMockId('pointOfInterest', 'poi-low') as PointOfInterestIdType,
            displayWeight: 10
        };
        const poiMid = {
            id: getMockId('pointOfInterest', 'poi-mid') as PointOfInterestIdType,
            displayWeight: 50
        };
        const poiHigh = {
            id: getMockId('pointOfInterest', 'poi-high') as PointOfInterestIdType,
            displayWeight: 90
        };
        const relLow = { destinationId, pointOfInterestId: poiLow.id };
        const relMid = { destinationId, pointOfInterestId: poiMid.id };
        const relHigh = { destinationId, pointOfInterestId: poiHigh.id };

        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findAll).mockResolvedValue({ items: [relMid, relLow, relHigh] });
        asMock(model.findAll).mockResolvedValue({ items: [poiMid, poiLow, poiHigh] });

        const result = await service.getPointsOfInterestForDestination(actorWithPerms, {
            destinationId,
            page: 1,
            pageSize: 10
        });

        const items = result.data?.pointsOfInterest;
        expect(items).toHaveLength(3);
        expect(items?.[0]?.displayWeight).toBe(90);
        expect(items?.[1]?.displayWeight).toBe(50);
        expect(items?.[2]?.displayWeight).toBe(10);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.getPointsOfInterestForDestination(actorWithPerms, {
            destinationId,
            page: 1,
            pageSize: 10
        });
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
