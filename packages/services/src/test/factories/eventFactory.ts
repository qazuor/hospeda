import type { EventId, EventType, UserId } from '@repo/types';
import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/types';

/**
 * Returns a mock EventType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EventType
 * @example
 * const event = getMockEvent({ id: 'event-2' as EventId });
 */
export const getMockEvent = (overrides: Partial<EventType> = {}): EventType => ({
    id: 'event-uuid' as EventId,
    slug: 'fiesta-nacional',
    summary: 'Fiesta Nacional',
    description: 'Una fiesta popular',
    media: undefined,
    category: EventCategoryEnum.FESTIVAL,
    date: { start: new Date(), end: new Date() },
    authorId: 'user-uuid' as UserId,
    locationId: undefined,
    organizerId: undefined,
    pricing: undefined,
    contact: undefined,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
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

export const getMockEventId = (id?: string): EventId =>
    (id && /^[0-9a-fA-F-]{36}$/.test(id) ? id : '00000000-0000-0000-0000-000000000002') as EventId;
