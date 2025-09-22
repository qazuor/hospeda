import { AttractionModel, DestinationModel, RDestinationAttractionModel } from '@repo/db';
import type { AttractionIdType, DestinationIdType } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceContext } from '../../../src';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;
const actorWithPerms = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });

const destination = { id: destinationId };
const attraction1 = {
    id: getMockId('feature', 'attr-1') as AttractionIdType,
    name: 'Test Attraction 1'
};
const attraction2 = {
    id: getMockId('feature', 'attr-2') as AttractionIdType,
    name: 'Test Attraction 2'
};
const relation1 = { destinationId, attractionId: attraction1.id };
const relation2 = { destinationId, attractionId: attraction2.id };

describe('AttractionService.getAttractionsForDestination', () => {
    let service: AttractionService;
    let model: AttractionModel;
    let relatedModel: RDestinationAttractionModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceContext;

    beforeEach(() => {
        model = createTypedModelMock(AttractionModel, ['findAll', 'findOne']);
        relatedModel = createTypedModelMock(RDestinationAttractionModel, ['findAll']);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne']);
        ctx = { logger: createLoggerMock() };
        service = new AttractionService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should return attractions for a destination (success)', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findAll).mockResolvedValue({ items: [relation1, relation2] });
        asMock(model.findAll).mockResolvedValue({ items: [attraction1, attraction2] });
        const result = await service.getAttractionsForDestination(actorWithPerms, {
            destinationId,
            page: 1,
            pageSize: 10
        });
        expect(result.data?.attractions).toEqual([attraction1, attraction2]);
        expect(result.error).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(null);
        const result = await service.getAttractionsForDestination(actorWithPerms, {
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
        const result = await service.getAttractionsForDestination(actorWithPerms, {
            destinationId,
            page: 1,
            pageSize: 10
        });
        expect(result.data?.attractions).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.getAttractionsForDestination(actorWithPerms, {
            destinationId,
            page: 1,
            pageSize: 10
        });
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
