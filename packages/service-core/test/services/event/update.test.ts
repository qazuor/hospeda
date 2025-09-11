import { EventModel } from '@repo/db';
import { EventCategoryEnum, PermissionEnum, VisibilityEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/event/event.helpers';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createEventUpdateInput, createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('EventService.update', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_UPDATE] });
    const actorNoPerm = createUser();
    const existingEvent = createMockEvent({ visibility: VisibilityEnum.PUBLIC });
    const eventId = existingEvent.id;
    const updateInput = createEventUpdateInput({ visibility: VisibilityEnum.PUBLIC });

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['findById', 'update']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should update an event successfully', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockResolvedValue({
            ...existingEvent,
            id: eventId,
            slug: 'festival-fiesta-nacional-2025-07-01'
        });
        const result = await service.update(actorWithPerm, eventId, updateInput);
        expectSuccess(result);
        expect(result.data).toMatchObject({
            ...existingEvent,
            id: eventId,
            slug: 'festival-fiesta-nacional-2025-07-01'
        });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        const result = await service.update(actorNoPerm, eventId, updateInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // Mock existing event
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        // Input inválido para forzar VALIDATION_ERROR
        const invalidInput = { category: 'INVALID_CATEGORY' as any };
        const result = await service.update(actorWithPerm, eventId, invalidInput);
        expectValidationError(result);
    });

    it('should return NOT_FOUND if event does not exist', async () => {
        (modelMock.findById as Mock).mockResolvedValue(null);
        const result = await service.update(actorWithPerm, eventId, updateInput);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.update(actorWithPerm, eventId, updateInput);
        expectInternalError(result);
    });

    it('updates slug if category changes', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        vi.spyOn(helpers, 'generateEventSlug').mockResolvedValue('new-cat-name-date');
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockResolvedValue({
            ...existingEvent,
            id: eventId,
            slug: 'new-cat-name-date'
        });
        const input = createEventUpdateInput({
            category: EventCategoryEnum.FESTIVAL
        });
        const result = await service.update(actorWithPerm, eventId, input);
        expect(helpers.generateEventSlug).toHaveBeenCalled();
        expect(result.data?.slug).toBe('new-cat-name-date');
    });

    it('updates slug if name changes', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        vi.spyOn(helpers, 'generateEventSlug').mockResolvedValue('cat-newname-date');
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockResolvedValue({
            ...existingEvent,
            id: eventId,
            slug: 'cat-newname-date'
        });
        const input = createEventUpdateInput({
            name: 'newname'
        });
        const result = await service.update(actorWithPerm, eventId, input);
        expect(helpers.generateEventSlug).toHaveBeenCalled();
        expect(result.data?.slug).toBe('cat-newname-date');
    });

    it('updates slug if date.start changes', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        vi.spyOn(helpers, 'generateEventSlug').mockResolvedValue('cat-name-newdate');
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockResolvedValue({
            ...existingEvent,
            id: eventId,
            slug: 'cat-name-newdate'
        });
        const input = createEventUpdateInput({
            date: {
                start: new Date('2024-09-01'),
                end: new Date('2024-09-01'),
                isAllDay: false,
                recurrence: undefined
            }
        });
        const result = await service.update(actorWithPerm, eventId, input);
        expect(helpers.generateEventSlug).toHaveBeenCalled();
        expect(result.data?.slug).toBe('cat-name-newdate');
    });

    it('does not update slug if none of the relevant fields change', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        vi.spyOn(helpers, 'generateEventSlug');
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockResolvedValue({ ...existingEvent, id: eventId });
        const input = {
            isFeatured: true
        };
        const _result = await service.update(actorWithPerm, eventId, input);
        expect(helpers.generateEventSlug).not.toHaveBeenCalled();
        // ...assert slug remains unchanged or as expected...
    });

    it('throws error if required fields for slug are missing on update', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        vi.spyOn(helpers, 'generateEventSlug').mockImplementation(() => {
            throw new Error(
                'Missing required fields for slug generation: category, name, or date.start'
            );
        });
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockResolvedValue(existingEvent);
        const input = createEventUpdateInput({
            name: '',
            date: {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-01'),
                isAllDay: false,
                recurrence: undefined
            }
        });
        const result = await service.update(actorWithPerm, eventId, input);
        expectValidationError(result);
    });
});
