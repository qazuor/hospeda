import { EventLocationModel } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { EventLocationFactoryBuilder } from '../../factories/eventLocationFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventLocationService.getByName', () => {
    let service: EventLocationService;
    let model: EventLocationModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const entity = EventLocationFactoryBuilder.create();

    beforeEach(() => {
        model = createTypedModelMock(EventLocationModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = new EventLocationService({ logger: loggerMock }, model);
        actor = createActor();
    });

    it('should return an event location by name (success)', async () => {
        asMock(model.findOne).mockResolvedValue(entity);
        const result = await service.getByName(actor, entity.city);
        expectSuccess(result);
        expect(result.data).toEqual(entity);
    });

    it('should return NOT_FOUND error if event location does not exist', async () => {
        asMock(model.findOne).mockResolvedValue(null);
        const result = await service.getByName(actor, entity.city);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.getByName(actor, entity.city);
        expectInternalError(result);
    });
});
