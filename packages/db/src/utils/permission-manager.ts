import type { PermissionEnum } from '@repo/types';

/**
 * Checks if the user has the given permission(s) (type-safe, enum-based).
 * @param user - The user object (must have a permissions array of PermissionEnum)
 * @param permissionOrPermissions - A single PermissionEnum or an array of PermissionEnum to check
 * @returns true if the user has all the required permissions, false otherwise
 */
export const hasPermission = (
    user: { permissions?: PermissionEnum[] },
    permissionOrPermissions: PermissionEnum | PermissionEnum[]
): boolean => {
    const userPerms = user.permissions ?? [];
    if (Array.isArray(permissionOrPermissions)) {
        return permissionOrPermissions.every((perm) => userPerms.includes(perm));
    }
    return userPerms.includes(permissionOrPermissions);
};
