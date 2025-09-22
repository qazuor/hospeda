import { AttractionModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AttractionService.hardDelete', () => {
    let service: AttractionService;
    let attractionModelMock: AttractionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const attraction = AttractionFactoryBuilder.create({ name: 'Test Attraction' });

    beforeEach(() => {
        attractionModelMock = createTypedModelMock(AttractionModel, ['findById', 'hardDelete']);
        loggerMock = createLoggerMock();
        service = new AttractionService({ logger: loggerMock }, attractionModelMock);
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_DELETE] });
    });

    it('should hard delete an attraction (success)', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        asMock(attractionModelMock.hardDelete).mockResolvedValue(1);
        const result = await service.hardDelete(actor, attraction.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return FORBIDDEN if actor lacks DESTINATION_DELETE permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        const result = await service.hardDelete(actor, attraction.id);
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if attraction does not exist', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(null);
        const result = await service.hardDelete(actor, attraction.id);
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(attractionModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.hardDelete(actor, attraction.id);
        expectInternalError(result);
    });
});
