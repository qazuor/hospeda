/**
 * @file owner-inbox-gate.ts
 * @description Access decision for the owner inbox pages (HOS-2433, HOS-2482).
 * Pure, so it is tested as behavior and both pages (`consultas-propietario/index`
 * and `[conversationId]`) call the SAME function before any API read. The
 * decision uses effective CONVERSATION_VIEW_OWN, independently of host creation.
 *
 * Pages now redirect denied publishers before this defensive read decision.
 * Signed-out visitors retain the login return URL.
 */

import { canAccessPublisherArea } from '@/lib/account/publisher-access';

/** Either let the page continue, or render the locked state. */
export type OwnerInboxGateDecision =
    | { readonly action: 'continue' }
    | { readonly action: 'locked' };

/**
 * Decides whether a signed-in user may see the owner inbox.
 *
 * @param params.permissions - Resolved effective permissions.
 * @returns `continue` for inbox authority, otherwise a defensive `locked` decision.
 */
export function resolveOwnerInboxGate({
    permissions
}: {
    readonly permissions: readonly string[];
}): OwnerInboxGateDecision {
    return canAccessPublisherArea({ area: 'inbox', permissions })
        ? { action: 'continue' }
        : { action: 'locked' };
}
