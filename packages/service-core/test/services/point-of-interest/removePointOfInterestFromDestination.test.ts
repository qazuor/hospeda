import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import type { DestinationIdType, PointOfInterestIdType } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig, ServiceContext } from '../../../src';
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { PointOfInterestFactoryBuilder } from '../../factories/pointOfInterestFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const pointOfInterestId = getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType;
const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;
const validInput = { destinationId, pointOfInterestId };
const actorWithPerms = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_DELETE] });
const actorNoPerms = createActor({ permissions: [] });

const pointOfInterest = PointOfInterestFactoryBuilder.create({ id: pointOfInterestId });
const destination = { id: destinationId, name: 'Test Destination' };
const relation = { destinationId, pointOfInterestId };

describe('PointOfInterestService.removePointOfInterestFromDestination', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let relatedModel: RDestinationPointOfInterestModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, ['findOne']);
        relatedModel = createTypedModelMock(RDestinationPointOfInterestModel, [
            'findOne',
            'softDelete'
        ]);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should remove point of interest from destination (success)', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(relation); // relation exists
        asMock(relatedModel.softDelete).mockResolvedValue(relation);
        const result = await service.removePointOfInterestFromDestination(
            actorWithPerms,
            validInput
        );
        expect(result.data?.relation).toEqual(relation);
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const result = await service.removePointOfInterestFromDestination(actorNoPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if point of interest does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(null);
        const result = await service.removePointOfInterestFromDestination(
            actorWithPerms,
            validInput
        );
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(null);
        const result = await service.removePointOfInterestFromDestination(
            actorWithPerms,
            validInput
        );
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if relation does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // relation does not exist
        const result = await service.removePointOfInterestFromDestination(
            actorWithPerms,
            validInput
        );
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if softDelete fails', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(relation); // relation exists
        asMock(relatedModel.softDelete).mockResolvedValue(null); // simulate failure
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // not found after delete
        const result = await service.removePointOfInterestFromDestination(
            actorWithPerms,
            validInput
        );
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('threads ctx.tx through every relation read/write (HOS-126)', async () => {
        // Sentinel transaction handle: proves each model call joins the
        // caller-provided transaction boundary rather than the pool.
        const marker = { __tx: 'hos-126' } as unknown;
        const ctxWithTx = { tx: marker } as unknown as ServiceContext;
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(relation); // relation exists
        asMock(relatedModel.softDelete).mockResolvedValue(relation);

        await service.removePointOfInterestFromDestination(actorWithPerms, validInput, ctxWithTx);

        expect(model.findOne).toHaveBeenCalledWith(expect.anything(), marker);
        expect(destinationModel.findOne).toHaveBeenCalledWith(expect.anything(), marker);
        expect(relatedModel.findOne).toHaveBeenCalledWith(expect.anything(), marker);
        expect(relatedModel.softDelete).toHaveBeenCalledWith(expect.anything(), marker);
    });
});
