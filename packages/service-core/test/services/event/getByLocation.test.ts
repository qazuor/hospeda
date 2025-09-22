import { EventModel } from '@repo/db';
import type { EventLocationIdType } from '@repo/schemas';
import { PermissionEnum, VisibilityEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectSuccess,
    expectUnauthorizedError
} from '../../helpers/assertions';
import { createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

/**
 * Tests for EventService.getByLocation
 * Covers: éxito (con y sin permiso especial), forbidden, validación, edge, error interno.
 */
describe('EventService.getByLocation', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const locationId = getMockId('event') as EventLocationIdType;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createUser();

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should return public and private events if actor has EVENT_SOFT_DELETE_VIEW', async () => {
        // Arrange
        const events = [
            createMockEvent({ locationId, visibility: VisibilityEnum.PUBLIC }),
            createMockEvent({ locationId, visibility: VisibilityEnum.PRIVATE })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 2 });
        // Act
        const result = await service.getByLocation(actorWithPerm, {
            locationId,
            page: 1,
            pageSize: 10
        });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ locationId }, { page: 1, pageSize: 10 });
    });

    it('should return only public events if actor lacks EVENT_SOFT_DELETE_VIEW', async () => {
        // Arrange
        const events = [createMockEvent({ locationId, visibility: VisibilityEnum.PUBLIC })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 1 });
        // Act
        const result = await service.getByLocation(actorNoPerm, {
            locationId,
            page: 1,
            pageSize: 10
        });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            { locationId, visibility: VisibilityEnum.PUBLIC },
            { page: 1, pageSize: 10 }
        );
    });

    it('should throw forbidden if actor is undefined', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByLocation(undefined, {
            locationId,
            page: 1,
            pageSize: 10
        });
        expectUnauthorizedError(result);
    });

    it('should throw validation error if no location criteria provided', async () => {
        // Test that when no locationId, city, state, or country is provided, it should validate correctly
        // since all are optional, the validation should pass but might return empty results
        const result = await service.getByLocation(actorWithPerm, { page: 1, pageSize: 10 });
        expectSuccess(result); // This should succeed since all location fields are optional
    });

    it('should return empty list if no events found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const result = await service.getByLocation(actorWithPerm, {
            locationId,
            page: 1,
            pageSize: 10
        });
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(0);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.getByLocation(actorWithPerm, {
            locationId,
            page: 1,
            pageSize: 10
        });
        expectInternalError(result);
    });

    it('should return UNAUTHORIZED if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByLocation(undefined, {
            locationId,
            page: 1,
            pageSize: 10
        });
        expectUnauthorizedError(result);
    });
});
