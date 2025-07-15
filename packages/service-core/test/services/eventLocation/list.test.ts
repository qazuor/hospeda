import { EventLocationModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { EventLocationFactoryBuilder } from '../../factories/eventLocationFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventLocationService.list', () => {
    let service: EventLocationService;
    let model: EventLocationModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const entity = EventLocationFactoryBuilder.create();
    const paginated = { items: [entity], total: 1 };

    beforeEach(() => {
        model = createTypedModelMock(EventLocationModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new EventLocationService({ logger: loggerMock }, model);
        actor = createActor({ permissions: [PermissionEnum.EVENT_LOCATION_UPDATE] });
    });

    it('should return a paginated list of event locations (success)', async () => {
        asMock(model.findAll).mockResolvedValue(paginated);
        const result = await service.list(actor, {});
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    it('should return FORBIDDEN if actor is null', async () => {
        // @ts-expect-error
        const result = await service.list(null, {});
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(model.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.list(actor, {});
        expectInternalError(result);
    });
});
