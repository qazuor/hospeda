import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { PointOfInterestService } from '../../../src/services/point-of-interest/point-of-interest.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const actorWithPerms = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_VIEW] });
const destination1Id = getMockId('destination', 'dest-1');
const destination2Id = getMockId('destination', 'dest-2');

describe('PointOfInterestService.getDestinationIdsByPointOfInterestSlugs', () => {
    let service: PointOfInterestService;
    let model: PointOfInterestModel;
    let relatedModel: RDestinationPointOfInterestModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(PointOfInterestModel, ['findDestinationIdsBySlugs']);
        relatedModel = createTypedModelMock(RDestinationPointOfInterestModel, ['findAll']);
        destinationModel = createTypedModelMock(DestinationModel, ['findAll']);
        ctx = { logger: createLoggerMock() };
        service = new PointOfInterestService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should resolve slugs to de-duplicated destination ids (success)', async () => {
        asMock(model.findDestinationIdsBySlugs).mockResolvedValue([destination1Id, destination2Id]);

        const result = await service.getDestinationIdsByPointOfInterestSlugs(actorWithPerms, {
            slugs: ['autodromo', 'playa_banco_pelay']
        });

        expect(result.data?.destinationIds).toEqual([destination1Id, destination2Id]);
        expect(result.error).toBeUndefined();
        expect(model.findDestinationIdsBySlugs).toHaveBeenCalledWith(
            ['autodromo', 'playa_banco_pelay'],
            undefined
        );
    });

    it('should resolve a single slug mapped to multiple destinations (M2M case)', async () => {
        asMock(model.findDestinationIdsBySlugs).mockResolvedValue([destination1Id, destination2Id]);

        const result = await service.getDestinationIdsByPointOfInterestSlugs(actorWithPerms, {
            slugs: ['puente-internacional']
        });

        expect(result.data?.destinationIds).toEqual([destination1Id, destination2Id]);
        expect(result.error).toBeUndefined();
    });

    it('should return an empty destinationIds array when no slug matches any point of interest', async () => {
        asMock(model.findDestinationIdsBySlugs).mockResolvedValue([]);

        const result = await service.getDestinationIdsByPointOfInterestSlugs(actorWithPerms, {
            slugs: ['unknown_slug']
        });

        expect(result.data?.destinationIds).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('should reject an empty slugs array at the schema boundary (VALIDATION_ERROR)', async () => {
        const result = await service.getDestinationIdsByPointOfInterestSlugs(actorWithPerms, {
            slugs: []
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
        expect(model.findDestinationIdsBySlugs).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if the model throws', async () => {
        asMock(model.findDestinationIdsBySlugs).mockRejectedValue(new Error('DB error'));

        const result = await service.getDestinationIdsByPointOfInterestSlugs(actorWithPerms, {
            slugs: ['autodromo']
        });

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
