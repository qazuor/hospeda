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

describe('AttractionService.restore', () => {
    let service: AttractionService;
    let attractionModelMock: AttractionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const deletedAttraction = AttractionFactoryBuilder.create({
        name: 'Test Attraction',
        deletedAt: new Date()
    });

    beforeEach(() => {
        attractionModelMock = createTypedModelMock(AttractionModel, ['findById', 'restore']);
        loggerMock = createLoggerMock();
        service = new AttractionService({ logger: loggerMock }, attractionModelMock);
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
    });

    it('should restore a soft-deleted attraction (success)', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(deletedAttraction);
        asMock(attractionModelMock.restore).mockResolvedValue(1);
        const result = await service.restore(actor, deletedAttraction.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return FORBIDDEN if actor lacks DESTINATION_UPDATE permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(attractionModelMock.findById).mockResolvedValue(deletedAttraction);
        const result = await service.restore(actor, deletedAttraction.id);
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if attraction does not exist', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(null);
        const result = await service.restore(actor, deletedAttraction.id);
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(attractionModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.restore(actor, deletedAttraction.id);
        expectInternalError(result);
    });

    it('should not restore an attraction that is not soft-deleted', async () => {
        const notDeleted = AttractionFactoryBuilder.create({ deletedAt: undefined });
        asMock(attractionModelMock.findById).mockResolvedValue(notDeleted);
        asMock(attractionModelMock.restore).mockResolvedValue(0);
        const result = await service.restore(actor, notDeleted.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });
});
