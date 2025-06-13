import type { EventId, EventType } from '@repo/types';
import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/types';
import { getMockUserId } from './userFactory';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock EventType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EventType
 * @example
 * const event = getMockEvent({ id: 'event-2' as EventId });
 */
export const getMockEvent = (overrides: Partial<EventType> = {}): EventType => ({
    id: getMockEventId(),
    slug: 'fiesta-nacional',
    summary: 'Fiesta Nacional',
    description: 'Una fiesta popular',
    media: undefined,
    category: EventCategoryEnum.FESTIVAL,
    date: {
        start: new Date().toISOString(),
        end: new Date().toISOString()
    },
    authorId: getMockUserId(),
    locationId: undefined,
    organizerId: undefined,
    pricing: undefined,
    contact: undefined,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    createdById: getMockUserId(),
    updatedById: getMockUserId(),
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
