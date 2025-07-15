import type { EventOrganizerModel } from '@repo/db';
import type { ServiceContext } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerService } from '../../../src/services/eventOrganizer/eventOrganizer.service';
import { createActor } from '../../factories/actorFactory';
import { createMockEventOrganizer } from '../../factories/eventOrganizerFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventOrganizerService.getByName', () => {
    let service: EventOrganizerService;
    let model: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const entity = createMockEventOrganizer();

    beforeEach(() => {
        model = createModelMock(['findOne']);
        loggerMock = createLoggerMock();
        service = new EventOrganizerService(
            { logger: loggerMock } as unknown as ServiceContext,
            model as StandardModelMock as unknown as EventOrganizerModel
        );
        actor = createActor();
    });

    it('should return an event organizer by name (success)', async () => {
        asMock(model.findOne).mockResolvedValue(entity);
        const result = await service.getByName(actor, entity.name);
        expectSuccess(result);
        expect(result.data).toEqual(entity);
    });

    it('should return NOT_FOUND error if event organizer does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(null);
        const result = await service.getByName(actor, entity.name);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.getByName(actor, entity.name);
        expectInternalError(result);
    });
});
