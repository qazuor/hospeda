import type { PublicUserType, UserId, UserType } from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, createPublicUser } from '@repo/types';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock UserType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns UserType
 * @example
 * const user = getMockUser({ id: 'user-2' as UserId });
 */
export const getMockUser = (overrides: Partial<UserType> = {}): UserType => ({
    id: '11111111-1111-1111-1111-111111111111' as UserId,
    userName: 'testuser',
    password: 'pw',
    role: RoleEnum.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '11111111-1111-1111-1111-111111111111' as UserId,
    updatedById: '11111111-1111-1111-1111-111111111111' as UserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    ...overrides
});

/**
 * Returns a mock PublicUserType object.
 * @returns PublicUserType
 * @example
 * const publicUser = getMockPublicUser();
 */
export const getMockPublicUser = (): PublicUserType => createPublicUser();

export const createMockUser = (overrides = {}) =>
    getMockUser({
        id: getMockUserId('user-1'),
        ...overrides
    });

export const getMockAdminUser = (overrides = {}) =>
    getMockUser({
        id: getMockUserId('admin-1'),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
        ...overrides
    });

export const getMockSuperAdminUser = (overrides = {}) =>
    getMockUser({
        id: getMockUserId('admin-2'),
        role: RoleEnum.SUPER_ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
        ...overrides
    });

export const getMockOwnerUser = (overrides = {}) =>
    getMockUser({
        id: getMockUserId('owner-user-1'),
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN],
        ...overrides
    });

export const getMockUserWithoutPermissions = (overrides = {}) =>
    getMockUser({
        id: getMockUserId('user-whitout-permission-1'),
        permissions: [],
        ...overrides
    });

export const getMockDisabledUser = (overrides = {}) =>
    getMockUser({
        id: getMockUserId('user-disabled-1'),
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN],
        lifecycleState: LifecycleStatusEnum.INACTIVE,
        ...overrides
    });

export const getMockUserId = (id?: string): UserId => {
    return getMockId('user', id) as UserId;
};
