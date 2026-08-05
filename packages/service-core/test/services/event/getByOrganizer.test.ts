import { EventModel } from '@repo/db';
import type { EventOrganizerIdType } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createMockEvent } from '../../factories/eventFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectSuccess,
    expectUnauthorizedError
} from '../../helpers/assertions';
import { createTypedModelMock } from '../../utils/modelMockFactory';

/** The scope every caller of this public route must receive, whoever they are. */
const PUBLISHED_SCOPE = {
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE
} as const;

/**
 * Tests for EventService.getByOrganizer
 * Covers: éxito (con y sin permiso especial), forbidden, validación, edge, error interno.
 */
describe('EventService.getByOrganizer', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const organizerId = getMockId('event') as EventOrganizerIdType;
    const actorWithPerm = createActor({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createActor();

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('scopes a PRIVILEGED actor to PUBLIC + ACTIVE — the route is actor-blind', async () => {
        // `GET /api/v1/public/events/organizer/{id}` declares `cacheTTL: 60`
        // under the `/api/v1/public/events` prefix of PUBLIC_CACHE_ENDPOINTS,
        // and that cache key carries no actor component. Widening the result
        // for an editor stored PRIVATE/DRAFT events for every later visitor.
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

        await service.getByOrganizer(actorWithPerm, { organizerId, page: 1, pageSize: 10 });

        expect(modelMock.findAll).toHaveBeenCalledWith(
            { organizerId, ...PUBLISHED_SCOPE },
            { page: 1, pageSize: 10 },
            undefined,
            undefined
        );
    });

    it('scopes an unprivileged actor to PUBLIC + ACTIVE', async () => {
        // `lifecycleState` is the half that was missing for EVERY caller.
        const events = [createMockEvent({ organizerId, visibility: VisibilityEnum.PUBLIC })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: events, total: 1 });

        const result = await service.getByOrganizer(actorNoPerm, {
            organizerId,
            page: 1,
            pageSize: 10
        });

        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith(
            { organizerId, ...PUBLISHED_SCOPE },
            { page: 1, pageSize: 10 },
            undefined,
            undefined
        );
    });

    it('should throw forbidden if actor is undefined', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByOrganizer(undefined, {
            organizerId,
            page: 1,
            pageSize: 10
        });
        expectUnauthorizedError(result);
    });

    it('should throw validation error if organizerId is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByOrganizer(actorWithPerm, {});
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return empty list if no events found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const result = await service.getByOrganizer(actorWithPerm, {
            organizerId,
            page: 1,
            pageSize: 10
        });
        expectSuccess(result);
        const { data } = result;
        if (!data) throw new Error('Expected data to be defined after expectSuccess');
        expect(data.items).toHaveLength(0);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.getByOrganizer(actorWithPerm, {
            organizerId,
            page: 1,
            pageSize: 10
        });
        expectInternalError(result);
    });

    it('should return UNAUTHORIZED if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getByOrganizer(undefined, {
            organizerId,
            page: 1,
            pageSize: 10
        });
        expectUnauthorizedError(result);
    });
});
