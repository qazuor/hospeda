/**
 * Re-export auth hooks for easier importing
 * This provides a clean API for components to use authentication
 */

import {
    useAuthContext,
    useHasAnyRole,
    useHasPermission,
    useHasRole
} from '@/hooks/use-auth-context';
import { PermissionEnum, RoleEnum } from '@repo/schemas';

export { useAuthContext, useHasAnyRole, useHasPermission, useHasRole };

/**
 * Use standardized permissions from @repo/schemas
 * Migrated from local PERMISSIONS to centralized PermissionEnum
 */
export const PERMISSIONS = {
    // User management - migrated to use PermissionEnum values
    USER_CREATE: PermissionEnum.USER_CREATE,
    USER_UPDATE: 'user.update', // TODO: Map to appropriate PermissionEnum
    USER_DELETE: PermissionEnum.USER_DELETE,
    USER_LIST: 'user.list', // TODO: Map to appropriate PermissionEnum

    // Admin access - migrated to use PermissionEnum values
    ADMIN_ACCESS: PermissionEnum.ACCESS_PANEL_ADMIN,

    // API access - migrated to use PermissionEnum values
    API_PUBLIC: PermissionEnum.ACCESS_API_PUBLIC,
    API_PRIVATE: PermissionEnum.ACCESS_API_ADMIN
} as const;

/**
 * Use standardized roles from @repo/schemas
 * Migrated from local ROLES to centralized RoleEnum
 */
export const ROLES = RoleEnum;

/**
 * Helper function to check if user is admin (SUPER_ADMIN or ADMIN)
 */
export function useIsAdmin(): boolean {
    const { user } = useAuthContext();
    return user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.ADMIN;
}

/**
 * Helper function to check if user is super admin
 */
export function useIsSuperAdmin(): boolean {
    const { user } = useAuthContext();
    return user?.role === ROLES.SUPER_ADMIN;
}

/**
 * Helper function to get user display name
 */
export function useUserDisplayName(): string {
    const { user } = useAuthContext();

    if (!user) return 'Guest';

    if (user.displayName) return user.displayName;

    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (fullName) return fullName;

    return 'User';
}

/**
 * Helper function to get user initials for avatar
 */
export function useUserInitials(): string {
    const { user } = useAuthContext();

    if (!user) return 'G';

    if (user.firstName && user.lastName) {
        return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }

    if (user.displayName) {
        const parts = user.displayName.split(' ');
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        }
        return parts[0][0].toUpperCase();
    }

    return 'U';
}
