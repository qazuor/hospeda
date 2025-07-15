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
