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

export const getMockEventId = (id?: string): EventId => {
    return getMockId('event', id) as EventId;
};
