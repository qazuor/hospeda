/**
 * @file owner-inbox-gate.ts
 * @description Access decision for the owner inbox pages (HOS-2433). Pure, so it
 * is tested as behavior and both pages (`consultas-propietario/index` and
 * `[conversationId]`) call the SAME function before any API read. The decision
 * is by permission through `hasAccommodationsNavAccess`, never by role name.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { hasAccommodationsNavAccess } from '@/lib/nav-gating';
import { buildUrl } from '@/lib/urls';

/** Either let the page continue, or redirect somewhere else. */
export type OwnerInboxGateDecision =
    | { readonly action: 'continue' }
    | { readonly action: 'redirect'; readonly location: string };

/**
 * Decides whether a signed-in user may see the owner inbox.
 *
 * @param params.roles - Every role the user holds.
 * @param params.locale - Active locale, used to build the redirect target.
 * @returns `continue` for host-tier users, otherwise a redirect to the account home.
 */
export function resolveOwnerInboxGate({
    roles,
    locale
}: {
    readonly roles: readonly string[] | null;
    readonly locale: SupportedLocale;
}): OwnerInboxGateDecision {
    if (hasAccommodationsNavAccess({ roles })) return { action: 'continue' };
    return { action: 'redirect', location: buildUrl({ locale, path: 'mi-cuenta' }) };
}
