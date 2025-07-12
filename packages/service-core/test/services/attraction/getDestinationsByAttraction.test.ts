import { AttractionModel, DestinationModel, RDestinationAttractionModel } from '@repo/db';
import type { AttractionId } from '@repo/types';
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceContext } from '../../../src';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const attractionId = getMockId('feature', 'attr-1') as AttractionId;
const actorWithPerms = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });

const attraction = AttractionFactoryBuilder.create({ id: attractionId });
const destination1 = { id: getMockId('destination', 'dest-1') };
const destination2 = { id: getMockId('destination', 'dest-2') };
const relation1 = { destinationId: destination1.id, attractionId };
const relation2 = { destinationId: destination2.id, attractionId };

describe('AttractionService.getDestinationsByAttraction', () => {
    let service: AttractionService;
    let model: AttractionModel;
    let relatedModel: RDestinationAttractionModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceContext;

    beforeEach(() => {
        model = createTypedModelMock(AttractionModel, ['findOne']);
        relatedModel = createTypedModelMock(RDestinationAttractionModel, ['findAll']);
        destinationModel = createTypedModelMock(DestinationModel, ['findAll']);
        ctx = { logger: createLoggerMock() };
        service = new AttractionService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should return destinations for an attraction (success)', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(relatedModel.findAll).mockResolvedValue({ items: [relation1, relation2] });
        asMock(destinationModel.findAll).mockResolvedValue({ items: [destination1, destination2] });
        const result = await service.getDestinationsByAttraction(actorWithPerms, { attractionId });
        expect(result.data?.destinations).toEqual([destination1, destination2]);
        expect(result.error).toBeUndefined();
    });

    it('should return NOT_FOUND if attraction does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(null);
        const result = await service.getDestinationsByAttraction(actorWithPerms, { attractionId });
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return empty array if no relations exist', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(relatedModel.findAll).mockResolvedValue({ items: [] });
        asMock(destinationModel.findAll).mockResolvedValue({ items: [] });
        const result = await service.getDestinationsByAttraction(actorWithPerms, { attractionId });
        expect(result.data?.destinations).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(relatedModel.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.getDestinationsByAttraction(actorWithPerms, { attractionId });
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
