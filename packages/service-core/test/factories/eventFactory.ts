import type {
    Event,
    EventCreateInput,
    EventIdType,
    EventLocationIdType,
    EventOrganizerIdType,
    UserIdType
} from '@repo/schemas';
import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock EventType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EventType
 * @example
 * const event = getMockEvent({ id: 'event-2' as EventId });
 */
export const getMockEvent = (overrides: Partial<Event> = {}): Event => ({
    id: getMockId('event') as EventIdType,
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
    authorId: getMockId('user') as UserIdType,
    locationId: getMockId('event') as EventLocationIdType,
    organizerId: getMockId('event') as EventOrganizerIdType,
    pricing: undefined,
    contactInfo: undefined,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING,
    createdById: getMockId('user') as UserIdType,
    updatedById: getMockId('user') as UserIdType,
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: undefined,
    tags: [],
    seo: undefined,
    ...overrides
});

export const createMockEvent = (overrides: Partial<Event> = {}): Event => getMockEvent(overrides);

export const createMockEventCreateInput = (
    overrides: Partial<EventCreateInput> = {}
): EventCreateInput => {
    const baseEvent = getMockEvent();
    // Remove fields that are not allowed in create schema per EventCreateInputSchema
    const {
        id,
        createdAt,
        updatedAt,
        createdById,
        updatedById,
        deletedAt,
        deletedById,
        moderationState,
        tags,
        ...createInput
    } = baseEvent;

    return {
        ...createInput,
        // organizerId is optional for creation, only add if provided
        ...(createInput.organizerId ? { organizerId: createInput.organizerId } : {}),
        ...overrides
    };
};

/**
 * Returns a valid input for EventService.update (matches EventUpdateSchema).
 * Only includes fields allowed by the Zod schema (no slug, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById).
 * The id field is handled separately in the update method.
 * @param overrides - Partial fields to override in the input.
 */
export const createMockEventUpdateInput = (
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

export const getMockEventId = (id?: string): EventIdType => {
    return getMockId('event', id) as EventIdType;
};

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use createMockEventCreateInput instead
 */
export const createMockEventInput = createMockEventCreateInput;

/**
 * @deprecated Use createMockEventCreateInput instead
 */
export const createEventInput = createMockEventCreateInput;

/**
 * @deprecated Use createMockEventUpdateInput instead
 */
export const createEventUpdateInput = createMockEventUpdateInput;
