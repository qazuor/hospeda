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

describe('AttractionService.softDelete', () => {
    let service: AttractionService;
    let attractionModelMock: AttractionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const attraction = AttractionFactoryBuilder.create({ name: 'Test Attraction' });

    beforeEach(() => {
        attractionModelMock = createTypedModelMock(AttractionModel, ['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        service = new AttractionService({ logger: loggerMock }, attractionModelMock);
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_DELETE] });
    });

    it('should soft delete an attraction (success)', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        asMock(attractionModelMock.softDelete).mockResolvedValue(1);
        const result = await service.softDelete(actor, attraction.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return FORBIDDEN if actor lacks DESTINATION_DELETE permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        const result = await service.softDelete(actor, attraction.id);
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if attraction does not exist', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(null);
        const result = await service.softDelete(actor, attraction.id);
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(attractionModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.softDelete(actor, attraction.id);
        expectInternalError(result);
    });

    it('should not soft delete an attraction that is already deleted', async () => {
        const alreadyDeleted = AttractionFactoryBuilder.create({ deletedAt: new Date() });
        asMock(attractionModelMock.findById).mockResolvedValue(alreadyDeleted);
        asMock(attractionModelMock.softDelete).mockResolvedValue(0);
        const result = await service.softDelete(actor, alreadyDeleted.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });
});
