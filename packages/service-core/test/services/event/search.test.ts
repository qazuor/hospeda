import { EventModel } from '@repo/db';
import { PermissionEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for EventService.search
 */
describe('EventService.search', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const actorNoPerm = createUser();
    const filters = { visibility: VisibilityEnum.PUBLIC };
    const page = 1;
    const pageSize = 10;
    const paginatedResult = {
        items: [createMockEvent({ visibility: VisibilityEnum.PUBLIC })],
        page,
        pageSize,
        total: 1
    };

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('should return paginated events (success)', async () => {
        (modelMock.findAll as Mock).mockResolvedValue(paginatedResult);
        const result = await service.search(actorWithPerm, { filters });
        expectSuccess(result);
        expect(result.data).toMatchObject(paginatedResult);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const result = await service.search(actorNoPerm, { filters });
        expectForbiddenError(result);
    });

    it('should return empty result if no events found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], page, pageSize, total: 0 });
        const result = await service.search(actorWithPerm, { filters });
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(0);
    });

    it('should return INTERNAL_ERROR if model.findAll throws', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.search(actorWithPerm, { filters });
        expectInternalError(result);
    });

    it('should return INTERNAL_ERROR if _afterSearch throws', async () => {
        (modelMock.findAll as Mock).mockResolvedValue(paginatedResult);
        vi.spyOn(
            service as unknown as { _afterSearch: () => void },
            '_afterSearch'
        ).mockRejectedValue(new Error('hook error'));
        const result = await service.search(actorWithPerm, { filters });
        expectInternalError(result);
    });
});
