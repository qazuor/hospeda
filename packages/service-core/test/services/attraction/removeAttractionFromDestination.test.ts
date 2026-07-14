import { AttractionModel, DestinationModel, RDestinationAttractionModel } from '@repo/db';
import type { AttractionIdType, DestinationIdType } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig, ServiceContext } from '../../../src';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';

import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const attractionId = getMockId('feature', 'attr-1') as AttractionIdType;
const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;
const validInput = { destinationId, attractionId };
const actorWithPerms = createActor({ permissions: [PermissionEnum.DESTINATION_DELETE] });
const actorNoPerms = createActor({ permissions: [] });

const attraction = AttractionFactoryBuilder.create({ id: attractionId });
const destination = { id: destinationId, name: 'Test Destination' };
const relation = { destinationId, attractionId };

describe('AttractionService.removeAttractionFromDestination', () => {
    let service: AttractionService;
    let model: AttractionModel;
    let relatedModel: RDestinationAttractionModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(AttractionModel, ['findOne']);
        relatedModel = createTypedModelMock(RDestinationAttractionModel, ['findOne', 'softDelete']);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne']);
        ctx = { logger: createLoggerMock() };
        service = new AttractionService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should remove attraction from destination (success)', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(relation); // relation exists
        asMock(relatedModel.softDelete).mockResolvedValue(relation);
        const result = await service.removeAttractionFromDestination(actorWithPerms, validInput);
        expect(result.data?.relation).toEqual(relation);
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const result = await service.removeAttractionFromDestination(actorNoPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if attraction does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(null);
        const result = await service.removeAttractionFromDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(destinationModel.findOne).mockResolvedValue(null);
        const result = await service.removeAttractionFromDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if relation does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // relation does not exist
        const result = await service.removeAttractionFromDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if softDelete fails', async () => {
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(relation); // relation exists
        asMock(relatedModel.softDelete).mockResolvedValue(null); // simulate failure
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // not found after delete
        const result = await service.removeAttractionFromDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('threads ctx.tx through every relation read/write (HOS-126)', async () => {
        // Sentinel transaction handle: proves each model call joins the
        // caller-provided transaction boundary rather than the pool.
        const marker = { __tx: 'hos-126' } as unknown;
        const ctxWithTx = { tx: marker } as unknown as ServiceContext;
        asMock(model.findOne).mockResolvedValue(attraction);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(relation); // relation exists
        asMock(relatedModel.softDelete).mockResolvedValue(relation);

        await service.removeAttractionFromDestination(actorWithPerms, validInput, ctxWithTx);

        expect(model.findOne).toHaveBeenCalledWith(expect.anything(), marker);
        expect(destinationModel.findOne).toHaveBeenCalledWith(expect.anything(), marker);
        expect(relatedModel.findOne).toHaveBeenCalledWith(expect.anything(), marker);
        expect(relatedModel.softDelete).toHaveBeenCalledWith(expect.anything(), marker);
    });
});
