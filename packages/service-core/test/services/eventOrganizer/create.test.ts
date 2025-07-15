import { EventOrganizerModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerService } from '../../../src/services/eventOrganizer/eventOrganizer.service';
import { createActor } from '../../factories/actorFactory';
import { createMockEventOrganizer } from '../../factories/eventOrganizerFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventOrganizerService.create', () => {
    let service: EventOrganizerService;
    let modelMock: EventOrganizerModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EventOrganizerModel, ['create']);
        loggerMock = createLoggerMock();
        actor = createActor({ permissions: [PermissionEnum.EVENT_ORGANIZER_MANAGE] });
        service = new EventOrganizerService({ logger: loggerMock }, modelMock);
    });

    it('creates an event organizer successfully', async () => {
        const input = createMockEventOrganizer();
        asMock(modelMock.create).mockResolvedValue(input);
        const result = await service.create(actor, input);
        expect(result.data).toEqual(input);
        expect(modelMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: input.name })
        );
    });

    it('returns error if actor lacks permission', async () => {
        actor.permissions = [];
        const input = createMockEventOrganizer();
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(modelMock.create).not.toHaveBeenCalled();
    });

    it('returns error if model.create throws', async () => {
        const input = createMockEventOrganizer();
        asMock(modelMock.create).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
});
