import type { RoleId } from '@repo/types';

/**
 * Returns a mock RoleId for admin role.
 * @returns RoleId
 * @example
 * const id = getMockAdminRoleId();
 */
export const getMockAdminRoleId = (): RoleId => 'ADMIN' as RoleId;

/**
 * Returns a mock RoleId for a role with no permissions.
 * @returns RoleId
 * @example
 * const id = getMockNoPermRoleId();
 */
export const getMockNoPermRoleId = (): RoleId => 'role-1' as RoleId;
