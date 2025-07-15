import { EventOrganizerModel } from '@repo/db';
import type { EventOrganizerType } from '@repo/types';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerService } from '../../../src/services/eventOrganizer/eventOrganizer.service';
import { createActor } from '../../factories/actorFactory';
import { createMockEventOrganizer } from '../../factories/eventOrganizerFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventOrganizerService.update', () => {
    let service: EventOrganizerService;
    let modelMock: EventOrganizerModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    let entity: ReturnType<typeof createMockEventOrganizer>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EventOrganizerModel, ['update', 'findById']);
        loggerMock = createLoggerMock();
        actor = createActor({ permissions: [PermissionEnum.EVENT_ORGANIZER_MANAGE] });
        entity = createMockEventOrganizer();
        service = new EventOrganizerService({ logger: loggerMock }, modelMock);
        asMock(modelMock.findById).mockResolvedValue(entity);
    });

    it('updates an event organizer successfully', async () => {
        const patch = { name: 'Updated Name' };
        asMock(modelMock.update).mockResolvedValue({ ...entity, ...patch });
        const result = await service.update(actor, entity.id, patch);
        expect(result.data).toEqual(expect.objectContaining({ name: 'Updated Name' }));
        expect(modelMock.update).toHaveBeenCalledWith(
            { id: entity.id },
            expect.objectContaining(patch)
        );
    });

    it('returns error if actor lacks permission', async () => {
        actor.permissions = [];
        const patch = { name: 'Updated Name' };
        const result = await service.update(actor, entity.id, patch);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(modelMock.update).not.toHaveBeenCalled();
    });

    it('returns error if model.update throws', async () => {
        const patch = { name: 'Updated Name' };
        asMock(modelMock.update).mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, entity.id, patch);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    it('returns error if entity not found', async () => {
        asMock(modelMock.findById).mockResolvedValue(null);
        const patch = { name: 'Updated Name' };
        const result = await service.update(
            actor,
            'nonexistent-id' as EventOrganizerType['id'],
            patch
        );
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('NOT_FOUND');
    });
});
