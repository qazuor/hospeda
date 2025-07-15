import { EventLocationModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventLocationService.count', () => {
    let service: EventLocationService;
    let model: EventLocationModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const countParams = { page: 1, pageSize: 10, filters: { city: 'Test City' } };

    beforeEach(() => {
        model = createTypedModelMock(EventLocationModel, ['count']);
        loggerMock = createLoggerMock();
        service = new EventLocationService({ logger: loggerMock }, model);
        actor = createActor({ permissions: [PermissionEnum.EVENT_LOCATION_UPDATE] });
    });

    it('should return the count of event locations (success)', async () => {
        asMock(model.count).mockResolvedValueOnce(1);
        const result = await service.count(actor, countParams);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error
        const result = await service.count(null, countParams);
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.count).mockImplementationOnce(() => {
            throw new Error('DB error');
        });
        const result = await service.count(actor, countParams);
        expectInternalError(result);
    });
});
