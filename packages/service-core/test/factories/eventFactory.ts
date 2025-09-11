import type { EventId, EventLocationId, EventOrganizerId, EventType, UserId } from '@repo/types';
import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
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
    description:
        'Una fiesta popular que celebra la cultura y tradiciones de nuestro país con música, bailes y comida típica.',
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
    contactInfo: undefined,
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
    const { id, createdAt, updatedAt, moderationState, tags, ...input } = getMockEvent();
    return { ...input, ...overrides };
};

/**
 * Returns a valid input for EventService.create (matches EventCreateSchema).
 * Only includes fields allowed by the Zod schema (no id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById, moderationState, tags).
 * @param overrides - Partial fields to override in the input.
 */
export const createEventInput = (overrides: Partial<ReturnType<typeof getMockEvent>> = {}) => {
    const {
        id,
        createdAt,
        updatedAt,
        deletedAt,
        createdById,
        updatedById,
        deletedById,
        moderationState,
        tags,
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
        moderationState,
        tags,
        ...rest
    } = getMockEvent();

    return {
        ...rest,
        ...overrides
    };
};

export const getMockEventId = (id?: string): EventId => {
    return getMockId('event', id) as EventId;
};
