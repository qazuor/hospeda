/**
 * @file owner-inbox-gate.ts
 * @description Access decision for the owner inbox pages (HOS-2433, HOS-2482).
 * Pure, so it is tested as behavior and both pages (`consultas-propietario/index`
 * and `[conversationId]`) call the SAME function before any API read. The
 * decision is by permission through `hasAccommodationsNavAccess`
 * (`PermissionEnum.ACCOMMODATION_CREATE`, the same predicate as the sidebar
 * entry), never by role name.
 *
 * A signed-in user without the permission is not bounced elsewhere: the page
 * renders the kit `LockedState` with `reason.kind = 'permission'` inside the
 * account shell (spec D9 «sin acceso único»). A signed-out visitor never gets
 * here: the page redirects to login with the return URL first.
 */

import { hasAccommodationsNavAccess } from '@/lib/nav-gating';

/** Either let the page continue, or render the locked state. */
export type OwnerInboxGateDecision =
    | { readonly action: 'continue' }
    | { readonly action: 'locked' };

/**
 * Decides whether a signed-in user may see the owner inbox.
 *
 * @param params.roles - Every role the user holds.
 * @returns `continue` for host-tier users, otherwise `locked`.
 */
export function resolveOwnerInboxGate({
    roles
}: {
    readonly roles: readonly string[] | null;
}): OwnerInboxGateDecision {
    return hasAccommodationsNavAccess({ roles }) ? { action: 'continue' } : { action: 'locked' };
}
