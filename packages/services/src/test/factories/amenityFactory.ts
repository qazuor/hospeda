import type { AmenityId, AmenityType, UserId } from '@repo/types';
import { AmenitiesTypeEnum, LifecycleStatusEnum } from '@repo/types';

/**
 * Returns a mock AmenityType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns AmenityType
 * @example
 * const amenity = getMockAmenity({ id: 'amenity-2' as AmenityId });
 */
export const getMockAmenity = (overrides: Partial<AmenityType> = {}): AmenityType => ({
    id: 'amenity-uuid' as AmenityId,
    name: 'WiFi',
    description: 'Wireless Internet',
    icon: 'wifi',
    isBuiltin: true,
    type: AmenitiesTypeEnum.CONNECTIVITY,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: { favorite: false },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedAt: undefined,
    deletedById: undefined,
    ...overrides
});

export const createMockAmenity = (overrides: Partial<AmenityType> = {}): AmenityType =>
    getMockAmenity(overrides);

export const getMockAmenityId = (id?: string): AmenityId =>
    (id && /^[0-9a-fA-F-]{36}$/.test(id)
        ? id
        : '99999999-9999-9999-9999-999999999999') as AmenityId;
