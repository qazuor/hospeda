/**
 * RoutePermissionGuard Component
 *
 * Client-side route guard that checks user permissions and redirects
 * to the dashboard if the user lacks the required permissions.
 * Used to protect edit/create routes that require specific permissions.
 */

import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
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
    const { isLoading } = useAuthContext();
    const userPermissions = useUserPermissions();
    const navigate = useNavigate();
    const { t } = useTranslations();
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

    // Render a sr-only h1 in all the "not yet allowed" states so the page never
    // ends up without a heading-1 for axe / screen readers, even during the
    // auth load window (which previously rendered null and was caught by the
    // sweep as page-has-heading-one on /events/organizers/$id/edit). The
    // placeholder string is the same in every branch, so SSR/client output
    // match and there's no hydration mismatch.
    const guardPlaceholder = <h1 className="sr-only">{t('admin-common.states.loading')}</h1>;

    // While auth is loading, render the placeholder (was: null).
    if (isLoading) {
        return guardPlaceholder;
    }

    // While permissions are loading (empty array), render the placeholder.
    if (userPermissions.length === 0) {
        return guardPlaceholder;
    }

    if (!hasAccess) {
        return guardPlaceholder;
    }

    return <>{children}</>;
}
