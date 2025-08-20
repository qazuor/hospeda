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

export { useAuthContext, useHasAnyRole, useHasPermission, useHasRole };

/**
 * Common permission checks
 */
export const PERMISSIONS = {
    // User management
    USER_CREATE: 'user.create',
    USER_UPDATE: 'user.update',
    USER_DELETE: 'user.delete',
    USER_LIST: 'user.list',

    // Admin access
    ADMIN_ACCESS: 'admin.access',

    // API access
    API_PUBLIC: 'access.apiPublic',
    API_PRIVATE: 'access.apiPrivate'
} as const;

/**
 * Common roles
 */
export const ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    EDITOR: 'EDITOR',
    HOST: 'HOST',
    USER: 'USER',
    GUEST: 'GUEST'
} as const;

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
