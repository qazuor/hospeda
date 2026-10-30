import { PermissionEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';

/**
 * AC:1692:5 (Coord-742, option C): unverified actors on closed-list routes
 * must not use staff bypasses. Keep only the permissions that open the four
 * bypass mechanisms; own reads still require BILLING_VIEW_OWN and
 * ACCOMMODATION_VIEW_OWN. Add any new staff bypass used by a closed-list route
 * here; TEST:1692:7 enforces that requirement.
 */
export const UNVERIFIED_STAFF_BYPASS_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.USER_READ_ALL, // Mi Cuenta handler and UserService._canView.
    // HOS-1693: no closed-list route reads this; keep it because removal fails open.
    PermissionEnum.ACCOMMODATION_UPDATE_ANY,
    // Read by accommodation/protected/getById.ts and checkCanView.
    PermissionEnum.ACCOMMODATION_VIEW_ALL,
    PermissionEnum.VENUE_VIEW_ALL, // venue/protected/getById.ts and _canView.
    PermissionEnum.EXPERIENCE_VIEW_ALL, // experience/protected/getById.ts and _canView.
    PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT, // ownership bypass.
    // enforceListingAccess action 15.
    PermissionEnum.LISTING_PURGE_ON_REQUEST // enforceListingAccess action 23.
];

/**
 * Removes only staff permissions that bypass ownership or private-read checks.
 * Returns the original actor when no listed permission is present.
 *
 * @param options - The context actor to filter.
 * @returns The same actor or a shallow copy with staff bypass permissions removed.
 */
export function stripStaffBypassPermissions(options: { readonly actor: Actor }): {
    readonly actor: Actor;
} {
    const { actor } = options;
    if (
        !actor.permissions.some((permission) =>
            UNVERIFIED_STAFF_BYPASS_PERMISSIONS.includes(permission)
        )
    ) {
        return { actor };
    }
    return {
        actor: {
            ...actor,
            permissions: actor.permissions.filter(
                (permission) => !UNVERIFIED_STAFF_BYPASS_PERMISSIONS.includes(permission)
            )
        }
    };
}
