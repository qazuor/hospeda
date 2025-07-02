import { EventModel } from '@repo/db';
import {
    type EventLocationId,
    PermissionEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Tests for EventService.getByLocation
 * Covers: éxito (con y sin permiso especial), forbidden, validación, edge, error interno.
 */
describe('EventService.getByLocation', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const locationId = getMockId('event') as EventLocationId;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createUser();

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService(modelMock, loggerMock);
    });

    it('should return public and private events if actor has EVENT_SOFT_DELETE_VIEW', async () => {
        // Arrange
        const events = [
            createMockEvent({ locationId, visibility: VisibilityEnum.PUBLIC }),
            createMockEvent({ locationId, visibility: VisibilityEnum.PRIVATE })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 2 });
        // Act
        const result = await service.getByLocation(actorWithPerm, { locationId });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ locationId }, { page: 1, pageSize: 20 });
    });

    it('should return only public events if actor lacks EVENT_SOFT_DELETE_VIEW', async () => {
        // Arrange
        const events = [createMockEvent({ locationId, visibility: VisibilityEnum.PUBLIC })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 1 });
        // Act
        const result = await service.getByLocation(actorNoPerm, { locationId });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            { locationId, visibility: VisibilityEnum.PUBLIC },
            { page: 1, pageSize: 20 }
        );
    });

    it('should throw forbidden if actor is undefined', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByLocation(undefined, { locationId });
        expectUnauthorizedError(result);
    });

    it('should throw validation error if locationId is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByLocation(actorWithPerm, {});
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return empty list if no events found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const result = await service.getByLocation(actorWithPerm, { locationId });
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(0);
    });

    it('should throw internal error if model fails', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.getByLocation(actorWithPerm, { locationId });
        expectInternalError(result);
    });
});

// Helper para error interno
const expectInternalError = (result: { error?: { code?: string } }) => {
    expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
};

// Helper para error unauthorized
const expectUnauthorizedError = (result: { error?: { code?: string } }) => {
    expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
};
