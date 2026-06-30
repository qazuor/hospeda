import { EventModel } from '@repo/db';
import {
    DestinationTypeEnum,
    EventCategoryEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

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

/**
 * Test suite for EventService.search
 */
describe('EventService.search', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createUser();
    const filters = { category: EventCategoryEnum.FESTIVAL };
    const page = 1;
    const pageSize = 10;
    const paginatedResult = {
        items: [createMockEvent({ visibility: VisibilityEnum.PUBLIC })],
        page,
        pageSize,
        total: 1
    };

    beforeEach(() => {
        // EventService._executeSearch loads relations via findAllWithRelations.
        modelMock = createTypedModelMock(EventModel, ['findAll', 'findAllWithRelations']);
        loggerMock = createLoggerMock();
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should return paginated events (success)', async () => {
        (modelMock.findAllWithRelations as Mock).mockResolvedValue(paginatedResult);
        const result = await service.search(actorWithPerm, { page, pageSize, ...filters });
        expectSuccess(result);
        expect(result.data).toMatchObject(paginatedResult);
    });

    it('should return success even if actor has no specific permissions', async () => {
        const emptyResult = { items: [], page, pageSize, total: 0 };
        (modelMock.findAllWithRelations as Mock).mockResolvedValue(emptyResult);
        const result = await service.search(actorNoPerm, { page, pageSize, ...filters });
        expectSuccess(result);
        expect(result.data).toMatchObject(emptyResult);
    });

    it('should return empty result if no events found', async () => {
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({
            items: [],
            page,
            pageSize,
            total: 0
        });
        const result = await service.search(actorWithPerm, { page, pageSize, ...filters });
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(0);
    });

    it('should return INTERNAL_ERROR if model.findAll throws', async () => {
        (modelMock.findAllWithRelations as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.search(actorWithPerm, { page, pageSize, ...filters });
        expectInternalError(result);
    });

    // SPEC-095 / F2 regression: the public listing path (_executeSearch) must
    // project location.destination → location.cityDestination so event cards
    // show the originating city. Mirrors the getUpcoming projection test.
    it('projects location.destination into location.cityDestination on each event', async () => {
        const eventWithCity = {
            ...createMockEvent({ visibility: VisibilityEnum.PUBLIC }),
            location: {
                id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                placeName: 'Anfiteatro Municipal',
                destinationId: cityRelation.id,
                destination: cityRelation
            }
        };
        (modelMock.findAllWithRelations as Mock).mockResolvedValue({
            items: [eventWithCity],
            page,
            pageSize,
            total: 1
        });
        const result = await service.search(actorWithPerm, { page, pageSize, ...filters });
        expectSuccess(result);
        const location = (result.data?.items[0] as { location?: { cityDestination?: unknown } })
            ?.location;
        expect(location?.cityDestination).toEqual(cityRelation);
    });

    it('should return INTERNAL_ERROR if _afterSearch throws', async () => {
        (modelMock.findAllWithRelations as Mock).mockResolvedValue(paginatedResult);
        vi.spyOn(
            service as unknown as { _afterSearch: () => void },
            '_afterSearch'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.search(actorWithPerm, { page, pageSize, ...filters });
        expectInternalError(result);
    });
});
