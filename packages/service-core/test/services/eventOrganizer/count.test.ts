import type { EventOrganizerModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import type { ServiceContext } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerService } from '../../../src/services/eventOrganizer/eventOrganizer.service';
import { createActor } from '../../factories/actorFactory';
import {
    expectInternalError,
    expectSuccess,
    expectUnauthorizedError
} from '../../helpers/assertions';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventOrganizerService.count', () => {
    let service: EventOrganizerService;
    let model: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const countParams = { page: 1, pageSize: 10, filters: { name: 'Test Organizer' } };

    beforeEach(() => {
        model = createModelMock(['count']);
        loggerMock = createLoggerMock();
        service = new EventOrganizerService(
            { logger: loggerMock } as unknown as ServiceContext,
            model as StandardModelMock as unknown as EventOrganizerModel
        );
        actor = createActor({ permissions: [PermissionEnum.EVENT_ORGANIZER_MANAGE] });
    });

    it('should return the count of event organizers (success)', async () => {
        asMock(model.count).mockResolvedValueOnce(1);
        const result = await service.count(actor, countParams);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error
        const result = await service.count(null, countParams);
        expectUnauthorizedError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.count).mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const result = await service.count(actor, countParams);
        expectInternalError(result);
    });
});
