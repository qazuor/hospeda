import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import type { DestinationIdType, PointOfInterestIdType } from '@repo/schemas';
import {
    PermissionEnum,
    PointOfInterestDestinationRelationEnum,
    ServiceErrorCode
} from '@repo/schemas';
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
// HOS-140: `relation` explicitly PRIMARY here mirrors the Zod schema's
// default — this is the AC-6 "default call, unchanged behavior" shape.
const validInput = {
    destinationId,
    pointOfInterestId,
    relation: PointOfInterestDestinationRelationEnum.PRIMARY
};
const actorWithPerms = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_CREATE] });
const actorNoPerms = createActor({ permissions: [] });

const pointOfInterest = PointOfInterestFactoryBuilder.create({ id: pointOfInterestId });
const destination = { id: destinationId, name: 'Test Destination' };
const relation = {
    destinationId,
    pointOfInterestId,
    relation: PointOfInterestDestinationRelationEnum.PRIMARY
};

describe('PointOfInterestService.addPointOfInterestToDestination', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let relatedModel: RDestinationPointOfInterestModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, ['findOne']);
        relatedModel = createTypedModelMock(RDestinationPointOfInterestModel, [
            'findOne',
            'create'
        ]);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should add point of interest to destination (success)', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // no existing relation
        asMock(relatedModel.create).mockResolvedValue(relation);
        const result = await service.addPointOfInterestToDestination(actorWithPerms, validInput);
        expect(result.data?.relation).toEqual(relation);
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const result = await service.addPointOfInterestToDestination(actorNoPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if point of interest does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(null);
        const result = await service.addPointOfInterestToDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(null);
        const result = await service.addPointOfInterestToDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return ALREADY_EXISTS if relation already exists', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(relation); // already exists
        const result = await service.addPointOfInterestToDestination(actorWithPerms, validInput);
        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if relation creation fails', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // no existing relation
        asMock(relatedModel.create).mockResolvedValue(null); // simulate failure
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // not found after create
        const result = await service.addPointOfInterestToDestination(actorWithPerms, validInput);
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
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // no existing relation
        asMock(relatedModel.create).mockResolvedValue(relation);

        await service.addPointOfInterestToDestination(actorWithPerms, validInput, ctxWithTx);

        expect(model.findOne).toHaveBeenCalledWith(expect.anything(), marker);
        expect(destinationModel.findOne).toHaveBeenCalledWith(expect.anything(), marker);
        expect(relatedModel.findOne).toHaveBeenCalledWith(expect.anything(), marker);
        expect(relatedModel.create).toHaveBeenCalledWith(expect.anything(), marker);
    });

    // HOS-140 — relation kind (AC-3)
    describe('relation kind (HOS-140)', () => {
        it('defaults to PRIMARY when relation is omitted from the raw input (Zod default)', async () => {
            asMock(model.findOne).mockResolvedValue(pointOfInterest);
            asMock(destinationModel.findOne).mockResolvedValue(destination);
            asMock(relatedModel.findOne).mockResolvedValueOnce(null); // no existing relation
            asMock(relatedModel.create).mockResolvedValue(relation);

            // Simulates a raw (untyped) caller — e.g. an HTTP body — that
            // never set `relation`. The Zod schema's `.default('PRIMARY')`
            // must fill it in at validation time (runWithLoggingAndValidation).
            const rawInput = { destinationId, pointOfInterestId } as unknown as typeof validInput;
            await service.addPointOfInterestToDestination(actorWithPerms, rawInput);

            expect(relatedModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    destinationId,
                    pointOfInterestId,
                    relation: PointOfInterestDestinationRelationEnum.PRIMARY
                }),
                // HOS-126: create now receives the (undefined here) tx handle.
                undefined
            );
        });

        it('creates a NEARBY row when relation: NEARBY is explicitly requested', async () => {
            asMock(model.findOne).mockResolvedValue(pointOfInterest);
            asMock(destinationModel.findOne).mockResolvedValue(destination);
            asMock(relatedModel.findOne).mockResolvedValueOnce(null); // no existing relation
            const nearbyRelation = {
                destinationId,
                pointOfInterestId,
                relation: PointOfInterestDestinationRelationEnum.NEARBY
            };
            asMock(relatedModel.create).mockResolvedValue(nearbyRelation);

            const result = await service.addPointOfInterestToDestination(actorWithPerms, {
                destinationId,
                pointOfInterestId,
                relation: PointOfInterestDestinationRelationEnum.NEARBY
            });

            expect(relatedModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    destinationId,
                    pointOfInterestId,
                    relation: PointOfInterestDestinationRelationEnum.NEARBY
                }),
                // HOS-126: create now receives the (undefined here) tx handle.
                undefined
            );
            expect(result.data?.relation).toEqual(nearbyRelation);
            expect(result.error).toBeUndefined();
        });

        it('rejects a duplicate pair with ALREADY_EXISTS regardless of the requested relation kind', async () => {
            asMock(model.findOne).mockResolvedValue(pointOfInterest);
            asMock(destinationModel.findOne).mockResolvedValue(destination);
            asMock(relatedModel.findOne).mockResolvedValueOnce(relation); // already exists as PRIMARY

            const result = await service.addPointOfInterestToDestination(actorWithPerms, {
                destinationId,
                pointOfInterestId,
                relation: PointOfInterestDestinationRelationEnum.NEARBY
            });

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(result.data).toBeUndefined();
            expect(relatedModel.create).not.toHaveBeenCalled();
        });
    });
});
