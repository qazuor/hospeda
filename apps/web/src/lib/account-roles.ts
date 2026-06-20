/**
 * @file account-roles.ts
 * @description Role-based helpers for the account dashboard.
 * Single source of truth for which roles grant host-level access.
 */

/**
 * Set of roles that grant access to property-management navigation
 * (sidebar "Mis propiedades" entry, host dashboard, owner inbox, etc.).
 *
 * Mirrors the predicate in `AccountLayout.astro` and the UserMenu
 * `accommodation.create` permission gate (SPEC-143 Finding #12).
 *
 * Roles:
 * - HOST: regular property owner managing their own listings.
 * - ADMIN / SUPER_ADMIN: platform staff.
 * - CLIENT_MANAGER: agency/business account.
 * - EDITOR: content moderator with editorial rights.
 *
 * A plain USER (tourist who browses/saves favorites) does NOT have
 * host-level access.
 */
export const ROLES_WITH_ACCOMMODATIONS_NAV = new Set<string>([
    'HOST',
    'ADMIN',
    'SUPER_ADMIN',
    'CLIENT_MANAGER',
    'EDITOR'
]);

/**
 * Returns true when the given role grants access to host-level features
 * (property management, host dashboard, owner inbox, etc.).
 *
 * @param role - The user's role string from `Astro.locals.user.role`,
 *               or `null` for unauthenticated visitors.
 * @returns `true` if the role is in the allowed set; `false` otherwise.
 */
export function isHostRole(role: string | null): boolean {
    if (role === null) {
        return false;
    }
    return ROLES_WITH_ACCOMMODATIONS_NAV.has(role);
}

/**
 * Set of roles that grant access to commerce-owner navigation
 * (sidebar "Mi comercio" entry, the commerce listing self-service area).
 *
 * Commerce listings (gastronomy, experiences) are a separate domain from
 * accommodation hosting, so this set is intentionally distinct from
 * `ROLES_WITH_ACCOMMODATIONS_NAV` — a plain accommodation HOST does NOT
 * get the commerce area, and a COMMERCE_OWNER does NOT get the host nav.
 *
 * Roles:
 * - COMMERCE_OWNER: merchant who owns one or more commerce listings.
 * - ADMIN / SUPER_ADMIN: platform staff (can reach every area).
 */
export const ROLES_WITH_COMMERCE_NAV = new Set<string>(['COMMERCE_OWNER', 'ADMIN', 'SUPER_ADMIN']);

/**
 * Returns true when the given role grants access to the commerce-owner
 * self-service area (the `mi-cuenta/comercio` subsection).
 *
 * @param role - The user's role string from `Astro.locals.user.role`,
 *               or `null` for unauthenticated visitors.
 * @returns `true` if the role is in the commerce set; `false` otherwise.
 */
export function isCommerceOwnerRole(role: string | null): boolean {
    if (role === null) {
        return false;
    }
    return ROLES_WITH_COMMERCE_NAV.has(role);
}
