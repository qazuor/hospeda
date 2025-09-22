import type {
    EventOrganizer,
    EventOrganizerCreateInput,
    EventOrganizerIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export const createMockEventOrganizer = (
    overrides: Partial<EventOrganizer> = {}
): EventOrganizer => ({
    id: getMockId('event') as EventOrganizerIdType,
    name: 'Test Organizer',
    description: undefined,
    logo: 'https://example.com/logo.png',
    contactInfo: undefined,
    socialNetworks: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: getMockId('user') as UserIdType,
    updatedById: getMockId('user') as UserIdType,
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
