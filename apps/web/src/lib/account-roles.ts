/**
 * @file account-roles.ts
 * @description Role-set helpers for the account dashboard.
 *
 * HOS-296: an account holds a SET of roles, not a scalar. Every predicate
 * here therefore asks "does the user hold a role that grants X" over the
 * whole set — accumulating hats can only ever ADD access.
 *
 * The gating decision itself lives in `nav-gating.ts` (`PERMISSION_ROLE_MAP`
 * + {@link hasAccommodationsNavAccess}), which is the single gating mechanism
 * for `apps/web` since HOS-296 §6.5. This module keeps only the role-set
 * documentation constants (mirrored by the map, asserted by
 * `test/lib/nav-gating.test.ts`) and the pricing-page router below.
 */

import { hasAccommodationsNavAccess } from '@/lib/nav-gating';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';

/**
 * Set of roles that grant access to property-management navigation
 * (sidebar "Mis propiedades" entry, host dashboard, owner inbox, etc.).
 *
 * Mirrored by `PERMISSION_ROLE_MAP[ACCOMMODATION_CREATE]` in `nav-gating.ts`
 * — that map is what actually evaluates the gate; this constant documents the
 * intent and anchors the drift test.
 *
 * Roles:
 * - HOST: regular property owner managing their own listings.
 * - ADMIN / SUPER_ADMIN: platform staff.
 *
 * A plain USER (tourist who browses/saves favorites) does NOT have
 * host-level access. Neither does EDITOR: editorial rights are about posts and
 * events, and the seed never grants an editor `ACCOMMODATION_CREATE`. It was
 * listed here (and in the mirrored map) until the sidebar was found offering
 * an editor a host area that every underlying endpoint refused.
 *
 * Nor does CLIENT_MANAGER, removed for the identical reason once H-20 found it
 * still here after the EDITOR fix: the seed grants that role
 * `ACCOMMODATION_VIEW_ALL`/`_VIEW_PRIVATE` and nothing that creates. Because
 * this constant and the mirrored map are BOTH hand-maintained, the drift test
 * between them stays green while the two agree on a wrong answer — which is
 * why the role membership itself is asserted in `nav-gating.test.ts`.
 */
export const ROLES_WITH_ACCOMMODATIONS_NAV = new Set<string>(['HOST', 'ADMIN', 'SUPER_ADMIN']);

/**
 * Owner (host) pricing page, locale-agnostic.
 *
 * HOS-942 pointed both constants one level deeper than they used to be:
 * `suscriptores/planes` became the five-audience INDEX rather than owner
 * pricing, and `suscriptores/turistas` became a 301. Every caller of
 * {@link resolveSubscriptionPlansPath} is answering "which catalogue can this
 * person actually buy from" — a chooser, or a redirect through one, is the wrong
 * answer to that question.
 *
 * HOS-1032 moved the two pages again, into the `/planes/` namespace, and this
 * is now READ from `PRICING_PAGE_PATH_BY_AUDIENCE` instead of spelled here. Two
 * literals were two things to update on a move, and the previous move had
 * already proved they get updated at different times: the URLs are one fact.
 */
const OWNER_PLANS_PATH = PRICING_PAGE_PATH_BY_AUDIENCE.owner;

/** Tourist pricing page, locale-agnostic. Also the anonymous default. */
const TOURIST_PLANS_PATH = PRICING_PAGE_PATH_BY_AUDIENCE.tourist;

/**
 * Set of roles that grant access to commerce-owner navigation
 * (sidebar "Mi comercio" entry, the commerce listing self-service area).
 *
 * Commerce listings (gastronomy, experiences) are a separate domain from
 * accommodation hosting, so this set is intentionally distinct from
 * `ROLES_WITH_ACCOMMODATIONS_NAV` — a plain accommodation HOST does NOT
 * get the commerce area, and a plain COMMERCE_OWNER does NOT get the host
 * nav. Since HOS-296 an account can hold both hats at once and then gets
 * BOTH areas (AC-1).
 *
 * Mirrored by `PERMISSION_ROLE_MAP[COMMERCE_EDIT_OWN]` in `nav-gating.ts`.
 *
 * Roles:
 * - COMMERCE_OWNER: merchant who owns one or more commerce listings. RETIRING
 *   (HOS-1077) — kept here for the expand window, dropped in release 2.
 * - GASTRONOMY_OWNER / EXPERIENCE_OWNER: the per-vertical replacements
 *   (HOS-1077). Both reach the same `/mi-cuenta/comercio` area; which listings
 *   they can actually edit is decided per listing by the API, not by this set.
 *   Listing them here is what stops an account holding ONLY a vertical role
 *   from losing the nav — a set that named just `COMMERCE_OWNER` would send
 *   the first gastronomy-only owner to an empty sidebar.
 * - ADMIN / SUPER_ADMIN: platform staff (can reach every area).
 */
export const ROLES_WITH_COMMERCE_NAV = new Set<string>([
    'COMMERCE_OWNER',
    'GASTRONOMY_OWNER',
    'EXPERIENCE_OWNER',
    'ADMIN',
    'SUPER_ADMIN'
]);

/**
 * Resolves which subscription pricing page a role-aware upsell or redirect
 * should target: a user holding any host-level hat belongs on the owner plans
 * page, while tourists and unauthenticated visitors belong on the tourist
 * plans page.
 *
 * Centralizes the host-vs-tourist pricing decision shared across role-aware
 * surfaces (BETA-165 dashboard/addons, BETA-201 checkout return pages). An
 * empty or `null` role set (anonymous, e.g. a MercadoPago redirect without a
 * session cookie) resolves to the tourist page — the safe default.
 *
 * HOS-296: a user who is BOTH a host and a tourist-tier subscriber lands on
 * the owner page, because holding the host hat is the stronger signal about
 * which catalog they can actually buy from.
 *
 * @param params.roles - Every role the user holds, or `null` for
 *   unauthenticated visitors.
 * @returns The locale-agnostic path segment: `'suscriptores/planes/anfitriones'` (owner) or
 *          `'suscriptores/planes/turistas'` (tourist / anonymous).
 */
export function resolveSubscriptionPlansPath({
    roles
}: {
    readonly roles: readonly string[] | null;
}): string {
    return hasAccommodationsNavAccess({ roles }) ? OWNER_PLANS_PATH : TOURIST_PLANS_PATH;
}

/**
 * Same decision as {@link resolveSubscriptionPlansPath}, but driven by the
 * `upgradeAudience` the API attaches to an entitlement error instead of by the
 * caller's own roles.
 *
 * **How much to trust the field depends on which gate sent it.** On a
 * `LIMIT_REACHED` 403 it is computed per limit, so it really is the server's
 * verdict. On an `ENTITLEMENT_REQUIRED` 402 it is not: `trialMiddleware`
 * hardcodes `'host'` on its trial-expired throws and omits the field entirely on
 * `NO_BILLING_ACCOUNT` / `NO_ACTIVE_SUBSCRIPTION`. Callers on the 402 path should
 * treat it as a hint and keep a default that suits their own surface (HOS-283).
 *
 * @param params.audience - `'host'` or `'tourist'`, from `details.upgradeAudience`.
 * @returns The locale-agnostic path segment for the matching pricing page.
 */
export function resolveSubscriptionPlansPathForAudience({
    audience
}: {
    audience: 'host' | 'tourist';
}): string {
    return audience === 'host' ? OWNER_PLANS_PATH : TOURIST_PLANS_PATH;
}
