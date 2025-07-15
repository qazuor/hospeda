import type { EventOrganizerModel } from '@repo/db';
import type { ServiceContext } from '@repo/service-core';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerService } from '../../../src/services/eventOrganizer/eventOrganizer.service';
import { createActor } from '../../factories/actorFactory';
import { createMockEventOrganizer } from '../../factories/eventOrganizerFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventOrganizerService.restore', () => {
    let service: EventOrganizerService;
    let model: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const entity = createMockEventOrganizer();
    const deletedEntity = { ...entity, deletedAt: new Date() };

    beforeEach(() => {
        model = createModelMock(['findById', 'restore']);
        loggerMock = createLoggerMock();
        service = new EventOrganizerService(
            { logger: loggerMock } as unknown as ServiceContext,
            model as StandardModelMock as unknown as EventOrganizerModel
        );
        actor = createActor({ permissions: [PermissionEnum.EVENT_ORGANIZER_MANAGE] });
    });

    it('should restore a soft-deleted event organizer (success)', async () => {
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
