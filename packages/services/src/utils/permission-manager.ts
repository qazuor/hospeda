import type { PermissionEnum, UserType } from '@repo/types';

/**
 * Options for advanced permission checking.
 */
export type HasPermissionOptions<T = unknown> = {
    /**
     * If true, user needs ANY of the permissions (default: false = ALL required)
     */
    any?: boolean;
    /**
     * Optional data/context for conditional checks (e.g. resource ownership)
     */
    data?: T;
    /**
     * Optional condition callback: must return true for permission to be granted
     */
    condition?: (user: UserType, data: T) => boolean;
    /**
     * Optional callback to log or receive the reason for denial
     */
    logReason?: (reason: string) => void;
};

/**
 * Checks if the user has the given permission(s) (type-safe, enum-based, advanced).
 * Supports: any/all, superadmin bypass, conditional logic, logging, public/guest users.
 */
export const hasPermission = <T = unknown>(
    user: { permissions?: PermissionEnum[]; role?: string },
    permissionOrPermissions: PermissionEnum | PermissionEnum[],
    options?: HasPermissionOptions<T>
): boolean => {
    // Superadmin bypass
    if (user.role === 'SUPER_ADMIN') return true;
    // Public/guest user: no permisos
    if (!user || user.role === 'GUEST' || user.role === 'PUBLIC') {
        options?.logReason?.('User is public/guest and has no permissions');
        return false;
    }
    const userPerms = user.permissions ?? [];
    const perms = Array.isArray(permissionOrPermissions)
        ? permissionOrPermissions
        : [permissionOrPermissions];
    // any vs all
    const has = options?.any
        ? perms.some((perm) => userPerms.includes(perm))
        : perms.every((perm) => userPerms.includes(perm));
    if (!has) {
        options?.logReason?.('User lacks required permission(s)');
        return false;
    }
    // Conditional logic
    if (options?.condition && options.data !== undefined) {
        const cond = options.condition(user as UserType, options.data);
        if (!cond) {
            options?.logReason?.('Condition callback returned false');
            return false;
        }
    }
    return true;
};
