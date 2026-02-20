/**
 * Hook to get real user permissions from AuthContext.
 *
 * Replaces the previously hardcoded userPermissions arrays
 * found across 24+ entity page hooks and route files.
 *
 * @module use-user-permissions
 */

import { useAuthContext } from '@/hooks/use-auth-context';
import type { PermissionEnum } from '@repo/schemas';
import { useMemo } from 'react';

/**
 * Returns the current user's permissions from AuthContext.
 *
 * @returns Array of PermissionEnum values from the authenticated user's session.
 *          Returns empty array when user is not authenticated or permissions are unavailable.
 */
export function useUserPermissions(): PermissionEnum[] {
    const { user } = useAuthContext();
    return useMemo(() => (user?.permissions as PermissionEnum[]) ?? [], [user?.permissions]);
}

/**
 * Check if the current user has a specific permission.
 *
 * @param permission - The permission to check
 * @returns true if the user has the specified permission
 */
export function useHasPermission(permission: PermissionEnum): boolean {
    const permissions = useUserPermissions();
    return permissions.includes(permission);
}

/**
 * Check if the current user has any of the specified permissions.
 *
 * @param requiredPermissions - Array of permissions to check (OR logic)
 * @returns true if the user has at least one of the specified permissions
 */
export function useHasAnyPermission(requiredPermissions: PermissionEnum[]): boolean {
    const permissions = useUserPermissions();
    return requiredPermissions.some((p) => permissions.includes(p));
}

/**
 * Check if the current user has all of the specified permissions.
 *
 * @param requiredPermissions - Array of permissions to check (AND logic)
 * @returns true if the user has all of the specified permissions
 */
export function useHasAllPermissions(requiredPermissions: PermissionEnum[]): boolean {
    const permissions = useUserPermissions();
    return requiredPermissions.every((p) => permissions.includes(p));
}
