import { AttractionModel, DestinationModel, RDestinationAttractionModel } from '@repo/db';
import type { AttractionId, DestinationId } from '@repo/types';
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
const destinationId = getMockId('destination', 'dest-1') as DestinationId;
const validInput = { destinationId, attractionId };
const actorWithPerms = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });
const actorNoPerms = createActor({ permissions: [] });

const attraction = AttractionFactoryBuilder.create({ id: attractionId });
const destination = { id: destinationId, name: 'Test Destination' };
const relation = { destinationId, attractionId };

describe('AttractionService.addAttractionToDestination', () => {
    let service: AttractionService;
    let model: AttractionModel;
    let relatedModel: RDestinationAttractionModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceContext;

    beforeEach(() => {
        model = createTypedModelMock(AttractionModel, ['findOne']);
        relatedModel = createTypedModelMock(RDestinationAttractionModel, ['findOne', 'create']);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne']);
        ctx = { logger: createLoggerMock() };
        service = new AttractionService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should add attraction to destination (success)', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // no existing relation
        asMock(relatedModel.create).mockResolvedValue(relation);
        const result = await service.addAttractionToDestination(actorWithPerms, validInput);
        expect(result.data?.relation).toEqual(relation);
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const result = await service.addAttractionToDestination(actorNoPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if attraction does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(null);
        const result = await service.addAttractionToDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(destinationModel.findOne).mockResolvedValue(null);
        const result = await service.addAttractionToDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return ALREADY_EXISTS if relation already exists', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(relation); // already exists
        const result = await service.addAttractionToDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if relation creation fails', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // no existing relation
        asMock(relatedModel.create).mockResolvedValue(null); // simulate failure
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // not found after create
        const result = await service.addAttractionToDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
