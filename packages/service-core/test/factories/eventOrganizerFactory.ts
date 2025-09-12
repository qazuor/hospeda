import type { EventOrganizerCreateInput } from '@repo/schemas';
import type { EventOrganizerId, EventOrganizerType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import { getMockId } from './utilsFactory';

export const createMockEventOrganizer = (
    overrides: Partial<EventOrganizerType> = {}
): EventOrganizerType => ({
    id: getMockId('event') as EventOrganizerId,
    name: 'Test Organizer',
    logo: 'https://example.com/logo.png',
    contactInfo: undefined,
    social: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user') as UserId,
    updatedById: getMockId('user') as UserId,
    deletedAt: undefined,
    deletedById: undefined,
    ...overrides
});

/**
 * Creates a valid event organizer create input (without auto-generated fields)
 * Use this for testing create operations
 */
export const createMockEventOrganizerCreateInput = (
    overrides: Partial<EventOrganizerCreateInput> = {}
): EventOrganizerCreateInput => {
    const baseInput = {
        name: 'Test Organizer',
        logo: 'https://example.com/logo.png'
    };

    return {
        ...baseInput,
        ...overrides
    } as EventOrganizerCreateInput;
};
