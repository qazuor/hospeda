/**
 * RoutePermissionGuard Component
 *
 * Client-side route guard that checks user permissions and redirects
 * to the dashboard if the user lacks the required permissions.
 * Used to protect edit/create routes that require specific permissions.
 */

import { useUserPermissions } from '@/hooks/use-user-permissions';
import type { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef } from 'react';

export interface RoutePermissionGuardProps {
    /** Permissions required to access this route (OR logic - any one suffices) */
    readonly permissions: PermissionEnum[];
    /** If true, ALL permissions are required (AND logic) */
    readonly requireAll?: boolean;
    /** Route to redirect to when permission is denied */
    readonly redirectTo?: string;
    /** Content to render when permission is granted */
    readonly children: ReactNode;
}

/**
 * Guards a route by checking user permissions client-side.
 * Redirects to dashboard (or custom route) if the user lacks required permissions.
 */
export function RoutePermissionGuard({
    permissions,
    requireAll = false,
    redirectTo = '/dashboard',
    children
}: RoutePermissionGuardProps) {
    const userPermissions = useUserPermissions();
    const navigate = useNavigate();
    const hasRedirected = useRef(false);

    const hasAccess =
        permissions.length === 0 ||
        (requireAll
            ? permissions.every((p) => userPermissions.includes(p))
            : permissions.some((p) => userPermissions.includes(p)));

    useEffect(() => {
        if (!hasAccess && userPermissions.length > 0 && !hasRedirected.current) {
            hasRedirected.current = true;
            navigate({ to: redirectTo });
        }
    }, [hasAccess, userPermissions, navigate, redirectTo]);

    // While permissions are loading (empty array), show nothing
    if (userPermissions.length === 0) {
        return null;
    }

    if (!hasAccess) {
        return null;
    }

    return <>{children}</>;
}
