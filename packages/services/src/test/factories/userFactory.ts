import crypto from 'node:crypto';
import type { PublicUserType, UserId, UserType } from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, createPublicUser } from '@repo/types';

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
    role: RoleEnum.ADMIN,
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
        id: getMockUserId(),
        ...overrides
    });

export const createMockAdmin = (overrides = {}) =>
    getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
        ...overrides
    });

export const createMockOwner = (overrides = {}) =>
    getMockUser({
        id: getMockUserId(),
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN],
        ...overrides
    });

export const createMockUserWithoutPermissions = (overrides = {}) =>
    getMockUser({
        id: getMockUserId(),
        permissions: [],
        ...overrides
    });

export const createMockDisabledUser = (overrides = {}) =>
    getMockUser({
        id: getMockUserId(),
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN],
        lifecycleState: LifecycleStatusEnum.INACTIVE,
        ...overrides
    });

export const createMockPublicUser = () => getMockPublicUser();

export const getMockUserId = (id?: string): UserId => {
    if (id && /^[0-9a-fA-F-]{36}$/.test(id)) return id as UserId;
    if (id) {
        // Genera un UUID determinista basado en el hash del string
        const hash = crypto.createHash('md5').update(id).digest('hex');
        // Formatea el hash como UUID v4
        return (`${hash.substring(0, 8)}-` +
            `${hash.substring(8, 12)}-` +
            `${hash.substring(12, 16)}-` +
            `${hash.substring(16, 20)}-` +
            `${hash.substring(20, 32)}`) as UserId;
    }
    return '11111111-1111-1111-1111-111111111111' as UserId;
};
