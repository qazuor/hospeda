import { EventLocationModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { EventLocationFactoryBuilder } from '../../factories/eventLocationFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventLocationService.hardDelete', () => {
    let service: EventLocationService;
    let model: EventLocationModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const entity = EventLocationFactoryBuilder.create();

    beforeEach(() => {
        model = createTypedModelMock(EventLocationModel, ['findById', 'hardDelete']);
        loggerMock = createLoggerMock();
        service = new EventLocationService({ logger: loggerMock }, model);
        actor = createActor({ permissions: [PermissionEnum.EVENT_LOCATION_UPDATE] });
    });

    it('should hard delete an event location (success)', async () => {
        asMock(model.findById).mockResolvedValue(entity);
        asMock(model.hardDelete).mockResolvedValue(1);
        const result = await service.hardDelete(actor, entity.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(model.findById).mockResolvedValue(entity);
        const result = await service.hardDelete(actor, entity.id);
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findById).mockResolvedValue(entity);
        asMock(model.hardDelete).mockRejectedValue(new Error('DB error'));
        const result = await service.hardDelete(actor, entity.id);
        expectInternalError(result);
    });
});
