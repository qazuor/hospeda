import { EventModel } from '@repo/db';
import {
    EventCategoryEnum,
    ModerationStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/event/event.helpers';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createEventInput, createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Tests for EventService.create
 * Covers: success, forbidden, validation, internal error, edge cases.
 */
describe('EventService.create', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ServiceLogger;
    const actorWithPerm = createUser({ permissions: [PermissionEnum.EVENT_CREATE] });
    const actorNoPerm = createUser();
    const rawInput = createEventInput({
        visibility: VisibilityEnum.PUBLIC,
        moderationState: ModerationStatusEnum.PENDING
    });
    const validInput = rawInput;
    const createdEvent = createMockEvent();

    beforeEach(() => {
        modelMock = createTypedModelMock(EventModel, ['create']);
        loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({ model: modelMock, logger: loggerMock });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create an event successfully', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        (modelMock.create as Mock).mockImplementation((_input: unknown) =>
            Promise.resolve({ ...createdEvent, slug: 'festival-fiesta-nacional-2025-07-01' })
        );
        const result = await service.create(actorWithPerm, validInput);
        expectSuccess(result);
        expect(result.data).toMatchObject({
            ...createdEvent,
            slug: 'festival-fiesta-nacional-2025-07-01'
        });
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const result = await service.create(actorNoPerm, validInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.create(actorWithPerm, {});
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        (modelMock.create as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actorWithPerm, validInput);
        expectInternalError(result);
    });

    it('generates slug using category, name, and date.start on create', async () => {
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);
        vi.spyOn(helpers, 'generateEventSlug').mockResolvedValue('music-jazz-2024-07-01');
        (modelMock.create as Mock).mockImplementation((_input: unknown) =>
            Promise.resolve({ ...createdEvent, slug: 'music-jazz-2024-07-01' })
        );
        const input = {
            ...createEventInput(),
            category: EventCategoryEnum.MUSIC,
            name: 'Jazz Night',
            date: { start: new Date('2024-07-01'), end: new Date('2024-07-01') },
            locationId: createEventInput().locationId,
            organizerId: createEventInput().organizerId,
            moderationState: ModerationStatusEnum.PENDING,
            slug: undefined // Remove slug to force generation
        };
        const result = await service.create(actorWithPerm, input);
        expect(helpers.generateEventSlug).toHaveBeenCalledWith(
            EventCategoryEnum.MUSIC,
            'Jazz Night',
            expect.any(Date)
        );
        expect(result.data?.slug).toBe('music-jazz-2024-07-01');
    });

    it('throws error if required fields for slug are missing', async () => {
        vi.spyOn(helpers, 'generateEventSlug').mockImplementation(() => {
            throw new Error(
                'Missing required fields for slug generation: category, name, or date.start'
            );
        });
        const input = {
            ...createEventInput(),
            name: '',
            date: { start: new Date('invalid'), end: new Date('invalid') },
            locationId: createEventInput().locationId,
            organizerId: createEventInput().organizerId,
            moderationState: ModerationStatusEnum.PENDING
        };
        const result = await service.create(actorWithPerm, input);
        expectValidationError(result);
    });
});
