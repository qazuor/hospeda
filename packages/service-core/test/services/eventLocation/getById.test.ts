import { EventLocationModel } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { EventLocationFactoryBuilder } from '../../factories/eventLocationFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventLocationService.getById', () => {
    let service: EventLocationService;
    let model: EventLocationModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const entity = EventLocationFactoryBuilder.create();
    // SPEC-083: EventLocationService.getDefaultListRelations() returns
    // { destination: true }, so getById flows through findOneWithRelations.
    // Tests assert against that exact config to detect accidental drift.
    const entityWithRelations = {
        ...entity,
        destination: { id: 'dest-1', name: 'Test Destination' }
    };

    beforeEach(() => {
        model = createTypedModelMock(EventLocationModel, ['findOneWithRelations']);
        loggerMock = createLoggerMock();
        service = new EventLocationService({ logger: loggerMock }, model);
        actor = createActor();
    });

    it('should return an event location by id (success)', async () => {
        asMock(model.findOneWithRelations).mockResolvedValue(entityWithRelations);
        const result = await service.getById(actor, entity.id);
        expectSuccess(result);
        expect(result.data).toEqual(entityWithRelations);
        expect(model.findOneWithRelations).toHaveBeenCalledWith(
            { id: entity.id },
            { destination: true },
            undefined
        );
        expect(model.findOne).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND error if event location does not exist', async () => {
        asMock(model.findOneWithRelations).mockResolvedValue(null);
        const result = await service.getById(actor, entity.id);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findOneWithRelations).mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, entity.id);
        expectInternalError(result);
    });
});
