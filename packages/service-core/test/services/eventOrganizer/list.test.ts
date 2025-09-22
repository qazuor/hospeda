import type { EventOrganizerModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import type { ServiceContext } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerService } from '../../../src/services/eventOrganizer/eventOrganizer.service';
import { createActor } from '../../factories/actorFactory';
import { createMockEventOrganizer } from '../../factories/eventOrganizerFactory';
import {
    expectInternalError,
    expectSuccess,
    expectUnauthorizedError
} from '../../helpers/assertions';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventOrganizerService.list', () => {
    let service: EventOrganizerService;
    let model: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const entity = createMockEventOrganizer();
    const paginated = { items: [entity], total: 1 };

    beforeEach(() => {
        model = createModelMock(['findAll']);
        loggerMock = createLoggerMock();
        service = new EventOrganizerService(
            { logger: loggerMock } as unknown as ServiceContext,
            model as StandardModelMock as unknown as EventOrganizerModel
        );
        actor = createActor({ permissions: [PermissionEnum.EVENT_ORGANIZER_MANAGE] });
    });

    it('should return a paginated list of event organizers (success)', async () => {
        asMock(model.findAll).mockResolvedValue(paginated);
        const result = await service.list(actor, {});
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error
        const result = await service.list(null, {});
        expectUnauthorizedError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.list(actor, {});
        expectInternalError(result);
    });
});
