/**
 * @file direct-email-route-guard.ts
 * @description `beforeLoad` factory shared by the direct email routes (HOS-2685).
 * Redirects to the forbidden page when the session lacks the permission.
 */

import type { PermissionEnum } from '@repo/schemas';
import { redirect } from '@tanstack/react-router';
import type { AuthState } from '@/lib/auth-session';

/**
 * Builds a `beforeLoad` that requires one permission.
 *
 * @param input.permission - Permission the route needs.
 * @returns A `beforeLoad` handler.
 */
export function requireDirectEmailPermission({
    permission
}: {
    readonly permission: PermissionEnum;
}) {
    return ({ context }: { readonly context: unknown }): void => {
        // TYPE-WORKAROUND: the router context cannot infer the auth fields the
        // parent beforeLoad adds; the cast restores the AuthState shape.
        const authState = context as AuthState;
        if (!authState.permissions?.includes(permission)) {
            throw redirect({ to: '/auth/forbidden' });
        }
    };
}
