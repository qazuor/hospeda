import { EventModel } from '@repo/db';
import { DestinationTypeEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';
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

/**
 * Relations always requested by getUpcoming / the listing surfaces. `location`
 * is loaded with its nested `destination` so cards can show the city (SPEC-095).
 */
const EXPECTED_LIST_RELATIONS = {
    author: true,
    organizer: true,
    location: { destination: true }
};

/** A valid `destination` relation that satisfies CityDestinationRefSchema. */
const cityRelation = {
    id: 'c4dd293f-9c0a-4b2e-8ade-7f9c5e4d3c12',
    slug: 'colon',
    name: 'Colón',
    summary: 'Ciudad turística sobre el río Uruguay',
    destinationType: DestinationTypeEnum.CITY,
    level: 4,
    path: '/argentina/litoral/entre-rios/colon',
    pathIds:
        '00000000-0000-0000-0000-000000000001,00000000-0000-0000-0000-000000000002,00000000-0000-0000-0000-000000000003,22222222-2222-2222-2222-222222222222'
};

describe('EventService.getUpcoming', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createUser();
    const fromDate = new Date('2024-06-01T00:00:00Z');
    const toDate = new Date('2024-06-30T23:59:59Z');

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAllWithRelations']);
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
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({ items: events, total: 2 });
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
        expect(modelMock.findAllWithRelations).toHaveBeenCalledWith(
            EXPECTED_LIST_RELATIONS,
            expect.objectContaining({
                'date.start': expect.objectContaining({
                    $gte: expect.any(Date),
                    $lte: expect.any(Date)
                })
            }),
            { page: 1, pageSize: 10 },
            undefined,
            undefined
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
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({ items: events, total: 1 });
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
        expect(modelMock.findAllWithRelations).toHaveBeenCalledWith(
            EXPECTED_LIST_RELATIONS,
            expect.objectContaining({
                'date.start': expect.objectContaining({
                    $gte: expect.any(Date),
                    $lte: expect.any(Date)
                }),
                visibility: VisibilityEnum.PUBLIC
            }),
            { page: 1, pageSize: 10 },
            undefined,
            undefined
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
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({ items: events, total: 1 });
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
        expect(modelMock.findAllWithRelations).toHaveBeenCalledWith(
            EXPECTED_LIST_RELATIONS,
            expect.objectContaining({
                'date.start': expect.objectContaining({
                    $gte: expect.any(Date),
                    $lte: expect.any(Date)
                }),
                visibility: VisibilityEnum.PUBLIC
            }),
            { page: 1, pageSize: 10 },
            undefined,
            undefined
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
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({ items: [], total: 0 });
        const result = await service.getUpcoming(actorWithPerm, {
            daysAhead: 30,
            page: 1,
            pageSize: 10
        });
        expectSuccess(result);
        expect(modelMock.findAllWithRelations).toHaveBeenCalled();
    });

    it('should return empty list if no events found', async () => {
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({ items: [], total: 0 });
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
        asMock(modelMock.findAllWithRelations).mockRejectedValue(new Error('DB error'));
        const result = await service.getUpcoming(actorWithPerm, {
            daysAhead: 7,

            page: 1,
            pageSize: 10
        });
        expectInternalError(result);
    });

    // SPEC-095 / F2 regression: event cards must show the originating city. The
    // service loads location.destination and projects it into
    // location.cityDestination so the public response carries the city.
    it('projects location.destination into location.cityDestination on each event', async () => {
        // Arrange: an event whose eager-loaded location carries a destination relation
        const eventWithCity = {
            ...createMockEvent({
                date: { start: fromDate, end: toDate },
                visibility: VisibilityEnum.PUBLIC
            }),
            // Partial location on purpose: the projection only reads
            // `location.destination`, so the other EventLocation fields are
            // irrelevant to this assertion.
            location: {
                id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                placeName: 'Anfiteatro Municipal',
                destinationId: cityRelation.id,
                destination: cityRelation
            }
        };
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({
            items: [eventWithCity],
            total: 1
        });
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
        const location = (data.items[0] as { location?: { cityDestination?: unknown } }).location;
        expect(location?.cityDestination).toEqual(cityRelation);
    });

    it('leaves events without a loaded location untouched', async () => {
        // Arrange: an event with no location relation (defensive — should not throw)
        const eventNoLocation = createMockEvent({
            date: { start: fromDate, end: toDate },
            visibility: VisibilityEnum.PUBLIC
        });
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({
            items: [eventNoLocation],
            total: 1
        });
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
        const location = (data.items[0] as { location?: { cityDestination?: unknown } }).location;
        expect(location?.cityDestination).toBeUndefined();
    });
});
