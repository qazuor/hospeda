import type { EventLocationId, EventLocationType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock EventLocationType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns EventLocationType
 * @example
 * const location = getMockEventLocation({ id: 'location-2' as EventLocationId });
 */
export const getMockEventLocation = (
    overrides: Partial<EventLocationType> = {}
): EventLocationType => ({
    id: 'location-uuid' as EventLocationId,
    street: 'Calle Falsa',
    number: '123',
    floor: '1',
    apartment: 'A',
    neighborhood: 'Centro',
    city: 'Ciudad',
    department: 'Depto',
    placeName: 'Salón',
    state: 'Entre Ríos',
    zipCode: '3200',
    country: 'AR',
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

export const createMockEventLocation = (
    overrides: Partial<EventLocationType> = {}
): EventLocationType => getMockEventLocation(overrides);

export const getMockEventLocationId = (id?: string): EventLocationId => {
    return getMockId('event-location', id) as EventLocationId;
};
