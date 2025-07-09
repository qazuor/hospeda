import { EventModel } from '@repo/db';
import { PermissionEnum, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createUser } from '../../factories/userFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

/**
 * Test suite for EventService.count
 */
describe('EventService.count', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createUser();
    const filters = { visibility: VisibilityEnum.PUBLIC };
    const countResult = { count: 5 };

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['count']);
        loggerMock = createLoggerMock();
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should return count of events (success)', async () => {
        asMock(modelMock.count).mockResolvedValue(countResult.count);
        const result = await service.count(actorWithPerm, { filters });
        expectSuccess(result);
        expect(result.data?.count).toBe(countResult.count);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const result = await service.count(actorNoPerm, { filters });
        expectForbiddenError(result);
    });

    it('should return count 0 if no events found', async () => {
        asMock(modelMock.count).mockResolvedValue(0);
        const result = await service.count(actorWithPerm, { filters });
        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });

    it('should return INTERNAL_ERROR if model.count throws', async () => {
        asMock(modelMock.count).mockRejectedValue(new Error('DB error'));
        const result = await service.count(actorWithPerm, { filters });
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterCount throws', async () => {
        asMock(modelMock.count).mockResolvedValue(countResult.count);
        vi.spyOn(
            service as unknown as { _afterCount: () => void },
            '_afterCount'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.count(actorWithPerm, { filters });
        expectInternalError(result);
    });
});
