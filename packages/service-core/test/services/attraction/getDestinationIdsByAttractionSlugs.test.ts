import { AttractionModel, DestinationModel, RDestinationAttractionModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceConfig } from '../../../src';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const actorWithPerms = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
const destination1Id = getMockId('destination', 'dest-1');
const destination2Id = getMockId('destination', 'dest-2');

describe('AttractionService.getDestinationIdsByAttractionSlugs', () => {
    let service: AttractionService;
    let model: AttractionModel;
    let relatedModel: RDestinationAttractionModel;
    let destinationModel: DestinationModel;
    let ctx: ServiceConfig;

    beforeEach(() => {
        model = createTypedModelMock(AttractionModel, ['findDestinationIdsBySlugs']);
        relatedModel = createTypedModelMock(RDestinationAttractionModel, ['findAll']);
        destinationModel = createTypedModelMock(DestinationModel, ['findAll']);
        ctx = { logger: createLoggerMock() };
        service = new AttractionService(ctx, model, relatedModel, destinationModel);
        vi.clearAllMocks();
    });

    it('should resolve slugs to de-duplicated destination ids (success)', async () => {
        asMock(model.findDestinationIdsBySlugs).mockResolvedValue([destination1Id, destination2Id]);

        const result = await service.getDestinationIdsByAttractionSlugs(actorWithPerms, {
            slugs: ['sede_carnaval', 'corsodromo']
        });

        expect(result.data?.destinationIds).toEqual([destination1Id, destination2Id]);
        expect(result.error).toBeUndefined();
        expect(model.findDestinationIdsBySlugs).toHaveBeenCalledWith(
            ['sede_carnaval', 'corsodromo'],
            undefined
        );
    });

    it('should return an empty destinationIds array when no slug matches any attraction', async () => {
        asMock(model.findDestinationIdsBySlugs).mockResolvedValue([]);

        const result = await service.getDestinationIdsByAttractionSlugs(actorWithPerms, {
            slugs: ['unknown_slug']
        });

        expect(result.data?.destinationIds).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('should reject an empty slugs array at the schema boundary (VALIDATION_ERROR)', async () => {
        const result = await service.getDestinationIdsByAttractionSlugs(actorWithPerms, {
            slugs: []
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
        expect(model.findDestinationIdsBySlugs).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR if the model throws', async () => {
        asMock(model.findDestinationIdsBySlugs).mockRejectedValue(new Error('DB error'));

        const result = await service.getDestinationIdsByAttractionSlugs(actorWithPerms, {
            slugs: ['sede_carnaval']
        });

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
