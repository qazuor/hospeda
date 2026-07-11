/**
 * Tests that `filters.categories` reaches EventModel from EventService's
 * `search()`/`count()` public entry points (HOS-96 T-006).
 *
 * `_executeSearch`/`_executeCount` destructure only the params they need
 * special handling for (pagination/sort, `destinationId`, price/date filters)
 * and forward the REST of the validated search input — including the new
 * `categories` array field — straight to `model.findAllWithRelations()` /
 * `model.count()`. This suite proves that pass-through actually happens
 * (i.e. `categories` isn't accidentally dropped anywhere along the way), and
 * that the singular `category` still forwards too (US-10 backward compat).
 */
import { EventModel } from '@repo/db';
import { EventCategoryEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createUser } from '../../factories/userFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('EventService — categories filter forwarding (HOS-96 T-006)', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    const actor = createUser({ permissions: [PermissionEnum.EVENT_SOFT_DELETE_VIEW] });
    const page = 1;
    const pageSize = 10;
    const emptyResult = { items: [], page, pageSize, total: 0 };

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findAll', 'findAllWithRelations', 'count']);
        loggerMock = createLoggerMock();
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    it('forwards filters.categories to model.findAllWithRelations on search()', async () => {
        asMock(modelMock.findAllWithRelations).mockResolvedValue(emptyResult);

        const result = await service.search(actor, {
            page,
            pageSize,
            categories: [EventCategoryEnum.MUSIC, EventCategoryEnum.CULTURE]
        });

        expectSuccess(result);
        expect(modelMock.findAllWithRelations).toHaveBeenCalled();
        const whereArg = asMock(modelMock.findAllWithRelations).mock.calls[0]?.[1];
        expect(whereArg).toMatchObject({
            categories: [EventCategoryEnum.MUSIC, EventCategoryEnum.CULTURE]
        });
    });

    it('forwards filters.categories to model.count on count()', async () => {
        asMock(modelMock.count).mockResolvedValue(0);

        const result = await service.count(actor, {
            page,
            pageSize,
            categories: [EventCategoryEnum.MUSIC, EventCategoryEnum.CULTURE]
        });

        expectSuccess(result);
        expect(modelMock.count).toHaveBeenCalled();
        const whereArg = asMock(modelMock.count).mock.calls[0]?.[0];
        expect(whereArg).toMatchObject({
            categories: [EventCategoryEnum.MUSIC, EventCategoryEnum.CULTURE]
        });
    });

    it('still forwards the singular category alone (backward compat, US-10)', async () => {
        asMock(modelMock.findAllWithRelations).mockResolvedValue(emptyResult);

        await service.search(actor, { page, pageSize, category: EventCategoryEnum.FESTIVAL });

        const whereArg = asMock(modelMock.findAllWithRelations).mock.calls[0]?.[1];
        expect(whereArg).toMatchObject({ category: EventCategoryEnum.FESTIVAL });
    });
});
