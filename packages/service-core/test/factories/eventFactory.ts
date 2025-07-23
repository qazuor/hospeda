import type { EventId, EventLocationId, EventOrganizerId, EventType, UserId } from '@repo/types';
import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    type RecurrenceTypeEnum,
    VisibilityEnum
} from '@repo/types';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock EventType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EventType
 * @example
 * const event = getMockEvent({ id: 'event-2' as EventId });
 */
export const getMockEvent = (overrides: Partial<EventType> = {}): EventType => ({
    id: getMockId('event') as EventId,
    slug: 'fiesta-nacional',
    name: 'Fiesta Nacional',
    summary: 'Fiesta Nacional',
    description: 'Una fiesta popular',
    media: undefined,
    category: EventCategoryEnum.FESTIVAL,
    date: {
        start: new Date(),
        end: new Date()
    },
    authorId: getMockId('user') as UserId,
    locationId: getMockId('event') as EventLocationId,
    organizerId: getMockId('event') as EventOrganizerId,
    pricing: undefined,
    contact: undefined,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING,
    createdById: getMockId('user') as UserId,
    updatedById: getMockId('user') as UserId,
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: undefined,
    tags: [],
    seo: undefined,
    ...overrides
});

export const createMockEvent = (overrides: Partial<EventType> = {}): EventType =>
    getMockEvent(overrides);

export const createMockEventInput = (
    overrides: Partial<Omit<EventType, 'id' | 'createdAt' | 'updatedAt'>> = {}
): Omit<EventType, 'id' | 'createdAt' | 'updatedAt'> => {
    const { id, createdAt, updatedAt, ...input } = getMockEvent();
    return { ...input, ...overrides };
};

/**
 * Returns a valid input for EventService.create (matches EventCreateSchema).
 * Only includes fields allowed by the Zod schema (no id, slug, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById).
 * @param overrides - Partial fields to override in the input.
 */
export const createEventInput = (overrides: Partial<ReturnType<typeof getMockEvent>> = {}) => {
    const {
        id,
        slug,
        createdAt,
        updatedAt,
        deletedAt,
        createdById,
        updatedById,
        deletedById,
        ...rest
    } = getMockEvent();
    return { ...rest, ...overrides };
};

/**
 * Returns a valid input for EventService.update (matches EventUpdateSchema).
 * Only includes fields allowed by the Zod schema (no slug, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById).
 * The id field is handled separately in the update method.
 * @param overrides - Partial fields to override in the input.
 */
export const createEventUpdateInput = (
    overrides: Partial<ReturnType<typeof getMockEvent>> = {}
) => {
    const {
        id,
        slug,
        createdAt,
        updatedAt,
        deletedAt,
        createdById,
        updatedById,
        deletedById,
        ...rest
    } = getMockEvent();

    // Convert date objects to ISO strings for schema validation
    const normalizedDate = {
        start: rest.date.start.toISOString(),
        end: rest.date.end?.toISOString(),
        isAllDay: rest.date.isAllDay,
        recurrence: rest.date.recurrence
    };

    // Handle date overrides if provided
    let finalDate = normalizedDate;
    if (overrides.date) {
        const overrideDate = overrides.date as {
            start: Date;
            end?: Date;
            isAllDay?: boolean;
            recurrence?: RecurrenceTypeEnum;
        };
        finalDate = {
            start: overrideDate.start.toISOString(),
            end: overrideDate.end?.toISOString(),
            isAllDay: overrideDate.isAllDay,
            recurrence: overrideDate.recurrence
        };
    }

    // Remove date from overrides to avoid conflicts
    const { date: _date, ...restOverrides } = overrides;

    return {
        ...rest,
        date: finalDate,
        ...restOverrides
    };
};

export const getMockEventId = (id?: string): EventId => {
    return getMockId('event', id) as EventId;
};
