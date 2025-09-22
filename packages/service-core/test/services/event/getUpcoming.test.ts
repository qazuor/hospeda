import { EventModel } from '@repo/db';
import { PermissionEnum, VisibilityEnum } from '@repo/schemas';
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
import { asMock } from '../../utils/test-utils';

describe('EventService.getUpcoming', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createUser();
    const fromDate = new Date('2024-06-01T00:00:00Z');
    const toDate = new Date('2024-06-30T23:59:59Z');

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should return public and private events if actor has EVENT_SOFT_DELETE_VIEW', async () => {
        // Arrange
        const events = [
            createMockEvent({
                date: { start: fromDate, end: toDate },
                visibility: VisibilityEnum.PUBLIC
            }),
            createMockEvent({
                date: { start: fromDate, end: toDate },
                visibility: VisibilityEnum.PRIVATE
            })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 2 });
        // Act
        const result = await service.getUpcoming(actorWithPerm, {
            daysAhead: 7,

            page: 1,
            pageSize: 10
        });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                'date.start': expect.objectContaining({
                    $gte: expect.any(Date),
                    $lte: expect.any(Date)
                })
            }),
            { page: 1, pageSize: 10 }
        );
    });

    it('should return only public events if actor lacks EVENT_SOFT_DELETE_VIEW', async () => {
        // Arrange
        const events = [
            createMockEvent({
                date: { start: fromDate, end: toDate },
                visibility: VisibilityEnum.PUBLIC
            })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 1 });
        // Act
        const result = await service.getUpcoming(actorNoPerm, {
            daysAhead: 7,

            page: 1,
            pageSize: 10
        });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                'date.start': expect.objectContaining({
                    $gte: expect.any(Date),
                    $lte: expect.any(Date)
                }),
                visibility: VisibilityEnum.PUBLIC
            }),
            { page: 1, pageSize: 10 }
        );
    });

    it('should return only public events and filter by fromDate if toDate is not provided', async () => {
        // Arrange
        const events = [
            createMockEvent({
                date: { start: fromDate, end: fromDate },
                visibility: VisibilityEnum.PUBLIC
            })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 1 });
        // Act
        const result = await service.getUpcoming(actorNoPerm, {
            daysAhead: 7,
            page: 1,
            pageSize: 10
        });
        // Assert
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                'date.start': expect.objectContaining({
                    $gte: expect.any(Date),
                    $lte: expect.any(Date)
                }),
                visibility: VisibilityEnum.PUBLIC
            }),
            { page: 1, pageSize: 10 }
        );
    });

    it('should return UNAUTHORIZED if actor is undefined', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getUpcoming(undefined, {
            daysAhead: 7,
            page: 1,
            pageSize: 10
        });
        expectUnauthorizedError(result);
    });

    it('should work with minimal required fields', async () => {
        // Test that the service works with just the required fields
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const result = await service.getUpcoming(actorWithPerm, {
            daysAhead: 30,
            page: 1,
            pageSize: 10
        });
        expectSuccess(result);
        expect(modelMock.findAll).toHaveBeenCalled();
    });

    it('should return empty list if no events found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const result = await service.getUpcoming(actorWithPerm, {
            daysAhead: 7,

            page: 1,
            pageSize: 10
        });
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(0);
    });

    it('should throw internal error if model fails', async () => {
        asMock(modelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.getUpcoming(actorWithPerm, {
            daysAhead: 7,

            page: 1,
            pageSize: 10
        });
        expectInternalError(result);
    });
});
