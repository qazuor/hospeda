/**
 * The one definition of "is this actor platform staff?" (HOS-296).
 *
 * **Deliberate, documented exception to `CLAUDE.md`'s "never check roles
 * directly, always `PermissionEnum`" rule.** The rule is about
 * AUTHORIZATION — what an actor may do — and it stands everywhere else. This
 * set answers a different question: WHO the actor is, for the purpose of
 * deciding that billing does not apply to them. Staff have no billing customer
 * and no subscription, so there is no capability to grant or check; a
 * `PermissionEnum` here would be a role wearing a permission's clothes, plus a
 * second place to keep in sync. The exception lives behind the named predicate
 * below so it stays greppable, singular, and impossible to widen by accident.
 *
 * It also used to be duplicated: the identical set was declared in BOTH
 * `middlewares/entitlement.ts` and `middlewares/owner-entitlement.ts`, and a
 * THIRD, differently-populated set (`AccommodationService.PRIVILEGED_ROLES`,
 * which swapped `EDITOR` for `HOST`) sat in `packages/service-core`. That
 * omission of `EDITOR` was half of the HOS-296 G-6 bug. Anything that means
 * "is this staff" must come through here.
 *
 * @module utils/staff-roles
 */

import { RoleEnum } from '@repo/schemas';

/**
 * Platform staff roles that bypass billing entitlements entirely (SPEC-171).
 *
 * These roles operate the admin panel on behalf of the platform and have no
 * billing customer/subscription. They are not "billing actors", so the
 * resolver grants them the unlimited entitlement set instead of treating
 * "no plan" as "no entitlements" (which would surface upsell gates at them).
 *
 * HOST is deliberately excluded: it is the only paying role and must keep
 * seeing the real plan entitlements (and upsell gates when on a free tier).
 * Non-staff, non-HOST roles (USER, GUEST, SPONSOR, COMMERCE_OWNER, SYSTEM)
 * keep the tourist-free defaults.
 */
export const STAFF_BILLING_BYPASS_ROLES: ReadonlySet<RoleEnum> = new Set([
    RoleEnum.SUPER_ADMIN,
    RoleEnum.ADMIN,
    RoleEnum.EDITOR,
    RoleEnum.CLIENT_MANAGER
]);

/**
 * Whether the actor holds ANY platform-staff hat.
 *
 * HOS-296 turned the old scalar comparison into a set intersection: holding
 * one staff hat is enough, so an EDITOR who is also a HOST is still staff. The
 * inverse also matters — an ADMIN who picks up the HOST hat does not stop
 * being staff, which is exactly the case the pre-HOS-296 single-role model
 * could not represent.
 *
 * @param roles - Every role the actor holds. `undefined`, `null` or empty →
 *   not staff (fail-closed on the bypass, i.e. normal billing applies).
 * @returns `true` when any held role is in {@link STAFF_BILLING_BYPASS_ROLES}.
 *
 * @example
 * ```ts
 * if (isStaffBypassRole(actor?.roles)) {
 *     // grant the unlimited entitlement set — no billing for staff
 * }
 * ```
 */
export function isStaffBypassRole(roles: readonly RoleEnum[] | null | undefined): boolean {
    return (
        roles !== null &&
        roles !== undefined &&
        roles.some((role) => STAFF_BILLING_BYPASS_ROLES.has(role))
    );
}
