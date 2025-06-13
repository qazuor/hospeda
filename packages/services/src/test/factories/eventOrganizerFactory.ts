import type { EventOrganizerId, EventOrganizerType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock EventOrganizerType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EventOrganizerType
 * @example
 * const organizer = getMockEventOrganizer({ id: 'organizer-2' as EventOrganizerId });
 */
export const getMockEventOrganizer = (
    overrides: Partial<EventOrganizerType> = {}
): EventOrganizerType => ({
    id: 'organizer-uuid' as EventOrganizerId,
    name: 'Organizador Ejemplo',
    logo: 'https://example.com/logo.png',
    contactInfo: undefined,
    social: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined,
    ...overrides
});

export const createMockEventOrganizer = (
    overrides: Partial<EventOrganizerType> = {}
): EventOrganizerType => getMockEventOrganizer(overrides);

export const getMockEventOrganizerId = (id?: string): EventOrganizerId => {
    return getMockId('event-organizer', id) as EventOrganizerId;
};
