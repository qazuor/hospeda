import { EventLocationModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { EventLocationFactoryBuilder } from '../../factories/eventLocationFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventLocationService.restore', () => {
    let service: EventLocationService;
    let model: EventLocationModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const entity = EventLocationFactoryBuilder.create();
    const deletedEntity = { ...entity, deletedAt: new Date() };

    beforeEach(() => {
        model = createTypedModelMock(EventLocationModel, ['findById', 'restore']);
        loggerMock = createLoggerMock();
        service = new EventLocationService({ logger: loggerMock }, model);
        actor = createActor({ permissions: [PermissionEnum.EVENT_LOCATION_UPDATE] });
    });

    it('should restore a soft-deleted event location (success)', async () => {
        asMock(model.findById).mockResolvedValue(deletedEntity);
        asMock(model.restore).mockResolvedValue(1);
        const result = await service.restore(actor, deletedEntity.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return 0 if already restored', async () => {
        asMock(model.findById).mockResolvedValue(entity);
        const result = await service.restore(actor, entity.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(model.findById).mockResolvedValue(deletedEntity);
        const result = await service.restore(actor, deletedEntity.id);
        expectForbiddenError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findById).mockResolvedValue(deletedEntity);
        asMock(model.restore).mockRejectedValue(new Error('DB error'));
        const result = await service.restore(actor, deletedEntity.id);
        expectInternalError(result);
    });
});
