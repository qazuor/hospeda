/**
 * Owner-scoped route guard — pure decision logic (SPEC-169 T-022 / D5).
 *
 * Extracted from the TanStack Router `beforeLoad` callback so it can be unit
 * tested without mocking TanStack Router internals or the `redirect()` API.
 *
 * Decision D5 (approved): the `/accommodations` global list route must redirect
 * an actor who holds `ACCOMMODATION_VIEW_OWN` but NOT `ACCOMMODATION_VIEW_ALL`
 * to `/me/accommodations`. This is belt-and-suspenders defence — the server-side
 * forced owner-scoping (§5.2) is the primary enforcement; this redirect ensures
 * the UI sends the user to the correct surface before any global data fetch.
 *
 * @module owner-scoped-guard
 */

import { PermissionEnum } from '@repo/schemas';

/**
 * Arguments for {@link decideOwnerScopedRedirect}. RO-RO.
 */
export interface DecideOwnerScopedRedirectArgs {
    /** Permissions held by the current actor. */
    readonly permissions: readonly string[];
}

/**
 * Decide whether an owner-scoped actor should be redirected away from the
 * global accommodations list.
 *
 * Rules (D5):
 * - `ACCOMMODATION_VIEW_OWN` AND NOT `ACCOMMODATION_VIEW_ALL` → redirect to `/me/accommodations`
 * - `ACCOMMODATION_VIEW_ALL` (staff) → `null` (allow, no redirect)
 * - Neither permission → `null` (no redirect; the normal auth layer handles access)
 * - Both permissions → `null` (VIEW_ALL wins; staff behaviour, no redirect)
 *
 * @param args - Object containing the actor's permission list.
 * @returns Redirect target path string, or `null` when no redirect is needed.
 */
export const decideOwnerScopedRedirect = (args: DecideOwnerScopedRedirectArgs): string | null => {
    const { permissions } = args;

    const hasViewAll = permissions.includes(PermissionEnum.ACCOMMODATION_VIEW_ALL);
    const hasViewOwn = permissions.includes(PermissionEnum.ACCOMMODATION_VIEW_OWN);

    // VIEW_ALL takes precedence (staff behaviour). Also covers the "both" case.
    if (hasViewAll) return null;

    // Owner-scoped actor: redirect to the scoped surface.
    if (hasViewOwn) return '/me/accommodations';

    // No accommodation view permission at all: let the normal guard handle it.
    return null;
};
