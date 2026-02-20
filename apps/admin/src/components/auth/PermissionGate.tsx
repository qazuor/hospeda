/**
 * PermissionGate Component
 *
 * Declarative permission checking component that conditionally renders
 * children based on the current user's permissions.
 *
 * @example
 * ```tsx
 * <PermissionGate permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
 *   <Button>Create Accommodation</Button>
 * </PermissionGate>
 *
 * <PermissionGate
 *   permissions={[PermissionEnum.USER_READ_ALL, PermissionEnum.USER_UPDATE_ROLES]}
 *   requireAll
 *   fallback={<p>No access</p>}
 * >
 *   <UserManagement />
 * </PermissionGate>
 * ```
 *
 * @module PermissionGate
 */

import { useAuthContext } from '@/hooks/use-auth-context';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import type { PermissionEnum } from '@repo/schemas';
import type { ReactNode } from 'react';

export interface PermissionGateProps {
    /** Required permissions to render children */
    readonly permissions: PermissionEnum[];
    /** If true, user must have ALL permissions. Default: false (any) */
    readonly requireAll?: boolean;
    /** Content to render when user has required permissions */
    readonly children: ReactNode;
    /** Optional fallback content when user lacks permissions */
    readonly fallback?: ReactNode;
}

/**
 * Conditionally renders children based on user permissions.
 * Returns null while auth is loading to prevent SSR hydration mismatches.
 *
 * @param props - PermissionGateProps
 * @returns Children if user has permissions, fallback or null otherwise
 */
export function PermissionGate({
    permissions,
    requireAll = false,
    children,
    fallback
}: PermissionGateProps) {
    const { isLoading } = useAuthContext();
    const userPermissions = useUserPermissions();

    // During SSR and initial hydration, auth state is not available.
    // Return null to match server output and avoid hydration mismatch.
    if (isLoading) {
        return null;
    }

    const hasAccess =
        permissions.length === 0 ||
        (requireAll
            ? permissions.every((p) => userPermissions.includes(p))
            : permissions.some((p) => userPermissions.includes(p)));

    if (hasAccess) {
        return <>{children}</>;
    }

    return <>{fallback ?? null}</>;
}
