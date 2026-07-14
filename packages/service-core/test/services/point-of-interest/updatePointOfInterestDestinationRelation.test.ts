import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import type { DestinationIdType, PointOfInterestIdType } from '@repo/schemas';
import {
    PermissionEnum,
    PointOfInterestDestinationRelationEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { PointOfInterestFactoryBuilder } from '../../factories/pointOfInterestFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const pointOfInterestId = getMockId('pointOfInterest', 'poi-1') as PointOfInterestIdType;
const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;
const validInput = {
    destinationId,
    pointOfInterestId,
    relation: PointOfInterestDestinationRelationEnum.NEARBY
};
const actorWithPerms = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_UPDATE] });
const actorNoPerms = createActor({ permissions: [] });

const pointOfInterest = PointOfInterestFactoryBuilder.create({ id: pointOfInterestId });
const destination = { id: destinationId, name: 'Test Destination' };
const existingRelation = {
    destinationId,
    pointOfInterestId,
    relation: PointOfInterestDestinationRelationEnum.PRIMARY
};
const updatedRelation = {
    destinationId,
    pointOfInterestId,
    relation: PointOfInterestDestinationRelationEnum.NEARBY
};

describe('PointOfInterestService.updatePointOfInterestDestinationRelation', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let relatedModel: RDestinationPointOfInterestModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, ['findOne']);
        relatedModel = createTypedModelMock(RDestinationPointOfInterestModel, [
            'findOne',
            'update'
        ]);
        destinationModel = createTypedModelMock(DestinationModel, ['findOne']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should update the relation kind of an existing relation (success)', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(existingRelation); // relation exists
        asMock(relatedModel.update).mockResolvedValue(updatedRelation);

        const result = await service.updatePointOfInterestDestinationRelation(
            actorWithPerms,
            validInput
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.relation).toEqual(updatedRelation);
        expect(relatedModel.update).toHaveBeenCalledWith(
            { destinationId, pointOfInterestId },
            { relation: PointOfInterestDestinationRelationEnum.NEARBY }
        );
    });

    it('should return FORBIDDEN if actor lacks POINT_OF_INTEREST_UPDATE', async () => {
        const result = await service.updatePointOfInterestDestinationRelation(
            actorNoPerms,
            validInput
        );
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
        expect(relatedModel.update).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if point of interest does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(null);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(existingRelation);

        const result = await service.updatePointOfInterestDestinationRelation(
            actorWithPerms,
            validInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
        expect(relatedModel.update).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(null);
        asMock(relatedModel.findOne).mockResolvedValueOnce(existingRelation);

        const result = await service.updatePointOfInterestDestinationRelation(
            actorWithPerms,
            validInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
        expect(relatedModel.update).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND (and NOT create the relation) when the relation row does not exist (AC-4)', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne).mockResolvedValueOnce(null); // relation does not exist

        const result = await service.updatePointOfInterestDestinationRelation(
            actorWithPerms,
            validInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
        expect(relatedModel.update).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if the update silently fails to persist', async () => {
        asMock(model.findOne).mockResolvedValue(pointOfInterest);
        asMock(destinationModel.findOne).mockResolvedValue(destination);
        asMock(relatedModel.findOne)
            .mockResolvedValueOnce(existingRelation) // exists check
            .mockResolvedValueOnce(null); // re-fetch after failed update also misses
        asMock(relatedModel.update).mockResolvedValue(null); // simulate failure

        const result = await service.updatePointOfInterestDestinationRelation(
            actorWithPerms,
            validInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
