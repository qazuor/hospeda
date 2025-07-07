import { EventModel } from '@repo/db';
import { EventCategoryEnum, PermissionEnum, VisibilityEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import * as helpers from '../../../src/services/event/event.helpers';
import type { EventCreateSchema } from '../../../src/services/event/event.schemas';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createMockEvent, createMockEventInput } from '../../factories/eventFactory';
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
    const rawInput = createMockEventInput({ visibility: VisibilityEnum.PUBLIC });
    const updateInput: z.infer<typeof EventCreateSchema> = {
        ...rawInput,
        date: {
            start: (rawInput.date.start as Date).toISOString(),
            end: (rawInput.date.end as Date).toISOString()
        },
        locationId: String(rawInput.locationId),
        organizerId: String(rawInput.organizerId)
    };

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
            slug: 'festival-fiesta-nacional-2025-07-01'
        });
        const result = await service.update(actorWithPerm, eventId, updateInput);
        expectSuccess(result);
        expect(result.data).toMatchObject({
            ...existingEvent,
            slug: 'festival-fiesta-nacional-2025-07-01'
        });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        const result = await service.update(actorNoPerm, eventId, updateInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // id inválido para forzar VALIDATION_ERROR
        const invalidId = 'invalid-id';
        const result = await service.update(actorWithPerm, invalidId, {});
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
            slug: 'new-cat-name-date'
        });
        const input = {
            ...createMockEventInput(),
            category: EventCategoryEnum.FESTIVAL,
            date: { start: '2024-01-01', end: '2024-01-01' },
            locationId: String(createMockEventInput().locationId),
            organizerId: String(createMockEventInput().organizerId)
        };
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
            slug: 'cat-newname-date'
        });
        const input = {
            ...createMockEventInput(),
            name: 'newname',
            date: { start: '2024-01-01', end: '2024-01-01' },
            locationId: String(createMockEventInput().locationId),
            organizerId: String(createMockEventInput().organizerId)
        };
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
            slug: 'cat-name-newdate'
        });
        const input = {
            ...createMockEventInput(),
            date: { start: '2024-09-01', end: '2024-09-01' },
            locationId: String(createMockEventInput().locationId),
            organizerId: String(createMockEventInput().organizerId)
        };
        const result = await service.update(actorWithPerm, eventId, input);
        expect(helpers.generateEventSlug).toHaveBeenCalled();
        expect(result.data?.slug).toBe('cat-name-newdate');
    });

    it('does not update slug if none of the relevant fields change', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        vi.spyOn(helpers, 'generateEventSlug');
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.update as Mock).mockResolvedValue(existingEvent);
        const input = {
            isFeatured: true,
            locationId: String(createMockEventInput().locationId),
            organizerId: String(createMockEventInput().organizerId)
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
        const input = {
            ...createMockEventInput(),
            name: '',
            date: { start: '', end: '' },
            locationId: String(createMockEventInput().locationId),
            organizerId: String(createMockEventInput().organizerId)
        };
        const result = await service.update(actorWithPerm, eventId, input);
        expectValidationError(result);
    });
});
