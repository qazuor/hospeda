import { EventOrganizerModel } from '@repo/db';
import type { EventOrganizerType } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerService } from '../../../src/services/eventOrganizer/eventOrganizer.service';
import { createActor } from '../../factories/actorFactory';
import { createMockEventOrganizer } from '../../factories/eventOrganizerFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventOrganizerService.getById', () => {
    let service: EventOrganizerService;
    let modelMock: EventOrganizerModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    let entity: ReturnType<typeof createMockEventOrganizer>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EventOrganizerModel, ['findOne']);
        loggerMock = createLoggerMock();
        actor = createActor();
        entity = createMockEventOrganizer();
        service = new EventOrganizerService({ logger: loggerMock }, modelMock);
    });

    it('returns the event organizer if found', async () => {
        asMock(modelMock.findOne).mockResolvedValue(entity);
        const result = await service.getById(actor, entity.id);
        expect(result.data).toEqual(entity);
    });

    it('returns error if not found', async () => {
        asMock(modelMock.findOne).mockResolvedValue(null);
        const result = await service.getById(actor, 'nonexistent-id' as EventOrganizerType['id']);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('returns error if model.findById throws', async () => {
        asMock(modelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, entity.id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
});
