import { EventModel } from '@repo/db';
import { PermissionEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { PUBLIC_READ_FLOOR } from '../../../src/services/moderation/public-read-floor';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createMockEvent } from '../../factories/eventFactory';
import {
    expectInternalError,
    expectSuccess,
    expectUnauthorizedError
} from '../../helpers/assertions';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('EventService.getFreeEvents', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const actorWithPerm = createActor({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createActor();

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should apply the public read floor even when the actor has EVENT_SOFT_DELETE_VIEW', async () => {
        // Arrange
        // HOS-374 §7.6.5: EVENT_SOFT_DELETE_VIEW no longer widens this public read
        // path — the floor is unconditional, so only public events are mocked back.
        const events = [
            createMockEvent({ pricing: undefined, visibility: VisibilityEnum.PUBLIC }),
            createMockEvent({ pricing: undefined, visibility: VisibilityEnum.PUBLIC })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 2 });
        // Act
        const result = await service.getFreeEvents(actorWithPerm, { page: 1, pageSize: 10 });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            { pricing: undefined, ...PUBLIC_READ_FLOOR },
            { page: 1, pageSize: 10 },
            undefined,
            undefined
        );
    });

    it('should apply the public read floor for an actor without elevated permissions', async () => {
        // Arrange
        const events = [createMockEvent({ pricing: undefined, visibility: VisibilityEnum.PUBLIC })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 1 });
        // Act
        const result = await service.getFreeEvents(actorNoPerm, { page: 1, pageSize: 10 });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            { pricing: undefined, ...PUBLIC_READ_FLOOR },
            { page: 1, pageSize: 10 },
            undefined,
            undefined
        );
    });

    it('should throw unauthorized if actor is undefined', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getFreeEvents(undefined, { page: 1, pageSize: 10 });
        expectUnauthorizedError(result);
    });

    it('should return empty list if no free events found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const result = await service.getFreeEvents(actorWithPerm, { page: 1, pageSize: 10 });
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(0);
    });

    it('should throw internal error if model fails', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.getFreeEvents(actorWithPerm, { page: 1, pageSize: 10 });
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.getFreeEvents(actorWithPerm, { page: 1, pageSize: 10 });
        expectInternalError(result);
    });

    it('should return UNAUTHORIZED if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getFreeEvents(undefined, { page: 1, pageSize: 10 });
        expectUnauthorizedError(result);
    });
});
