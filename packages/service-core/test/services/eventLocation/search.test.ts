import { EventLocationModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { EventLocationFactoryBuilder } from '../../factories/eventLocationFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventLocationService.search', () => {
    let service: EventLocationService;
    let model: EventLocationModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const searchParams = {
        page: 1,
        pageSize: 10,
        filters: { city: new EventLocationFactoryBuilder().build().city }
    };

    beforeEach(() => {
        model = createTypedModelMock(EventLocationModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new EventLocationService({ logger: loggerMock }, model);
        actor = createActor({ permissions: [PermissionEnum.EVENT_LOCATION_UPDATE] });
    });

    it('should return a paginated list of event locations (success)', async () => {
        const entity = new EventLocationFactoryBuilder().build();
        asMock(model.findAll).mockResolvedValueOnce({ items: [entity], total: 1 });
        const result = await service.search(actor, searchParams);
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error
        const result = await service.search(null, searchParams);
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findAll).mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const result = await service.search(actor, searchParams);
        expectInternalError(result);
    });
});
