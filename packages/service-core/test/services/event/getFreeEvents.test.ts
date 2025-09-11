import { EventModel } from '@repo/db';
import { PermissionEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
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
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createUser();

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should return public and private free events if actor has EVENT_SOFT_DELETE_VIEW', async () => {
        // Arrange
        const events = [
            createMockEvent({ pricing: undefined, visibility: VisibilityEnum.PUBLIC }),
            createMockEvent({ pricing: undefined, visibility: VisibilityEnum.PRIVATE })
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
            { pricing: undefined },
            { page: 1, pageSize: 10 }
        );
    });

    it('should return only public free events if actor lacks EVENT_SOFT_DELETE_VIEW', async () => {
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
            { pricing: undefined, visibility: VisibilityEnum.PUBLIC },
            { page: 1, pageSize: 10 }
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
