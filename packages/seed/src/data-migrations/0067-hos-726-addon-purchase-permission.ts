/**
 * @fileoverview
 * Data migration: 0067-hos-726-addon-purchase-permission
 *
 * Companion delta for HOS-726. The seed's `ROLE_PERMISSIONS` constant
 * (`packages/seed/src/required/rolePermissions.seed.ts`) has already been edited
 * so a fresh `db:fresh`/`db:fresh-dev` grants `BILLING_ADDON_PURCHASE` — this
 * migration is the delta for environments that already seeded without it
 * (staging/prod), per the HOS-25 seed dual-write rule.
 *
 * Editing only the baseline would be the usual silent bug: fresh databases would
 * show the new "Complementos" nav entry while staging and prod hid it from
 * everyone, since the SSR sidebar approximates the gate through
 * `PERMISSION_ROLE_MAP` and a role that holds no matching grant fails closed.
 *
 * ## Ordering against the structural migration
 *
 * `permission` is a POSTGRES ENUM (`permission_enum`, built from `PermissionEnum`
 * by `packages/db/src/schemas/enums.dbschema.ts`). This migration inserts rows
 * whose `permission` column carries a value that does not exist in that type
 * until `packages/db/src/migrations/0096_third_morlun.sql` has run, so against a
 * live database it MUST follow it. That is exactly the documented run order:
 * `db:migrate` → `db:apply-extras` → `db:seed:migrate`. Running this one first
 * fails loudly (`invalid input value for enum permission_enum`) rather than
 * silently, which is the desired shape.
 *
 * ## What this migration grants
 *
 * `BILLING_ADDON_PURCHASE` to `HOST`, `COMMERCE_OWNER`, `ADMIN` and
 * `SUPER_ADMIN` — the roles that can actually hold an entitlement-granting
 * subscription in one of the add-on catalog's product domains, plus the two
 * staff roles that see every gated nav entry.
 *
 * Deliberately NOT granted to:
 * - `USER` — a plain tourist can never hold such a subscription, so the add-on
 *   page only ever shows them its empty state. This exclusion is the entire
 *   reason the permission exists: the two obvious candidates
 *   (`SUBSCRIPTION_VIEW_OWN`, `BILLING_VIEW_OWN`) are both granted to `USER`.
 * - `EDITOR`, `CLIENT_MANAGER`, `SPONSOR` — no product subscription of their own.
 * - `GUEST`, `SYSTEM` — not interactive account tiers.
 *
 * ## `role_permission` table shape
 *
 * `role_permission` has a COMPOSITE primary key (`role`, `permission` — see
 * `packages/db/src/schemas/user/r_role_permission.dbschema.ts`). Insertion goes
 * through a plain `ctx.db.insert(rolePermission).values(...).onConflictDoNothing()`,
 * matching `0062-hos686-commerce-listing-moderation-permission.ts` — one
 * idempotent round-trip, no separate existence check needed.
 *
 * ## `destructive` flag decision
 *
 * `false` — this only ever ADDS grants (`INSERT ... ON CONFLICT DO NOTHING`).
 * It never deletes or narrows access, so the production destructive-migration
 * gate does not apply.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0067-hos-726-addon-purchase-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The single HOS-726 permission this migration hands out.
 *
 * Exported so the migration's own test can assert it against the seed's
 * `ROLE_PERMISSIONS` directly. A test that re-declared the value locally would
 * compare its own copy to the seed and stay green while THIS constant drifted.
 */
export const ADDON_PURCHASE_PERMISSION = PermissionEnum.BILLING_ADDON_PURCHASE;

/**
 * The roles that receive it: the two paying tiers plus the two staff roles.
 * `USER` is absent on purpose — see the file header.
 */
export const GRANTED_ROLES: readonly RoleEnum[] = [
    RoleEnum.SUPER_ADMIN,
    RoleEnum.ADMIN,
    RoleEnum.HOST,
    RoleEnum.COMMERCE_OWNER
];

/** `(role, permission)` pairs this migration ensures exist. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = GRANTED_ROLES.map(
    (role) => ({ role, permission: ADDON_PURCHASE_PERMISSION })
);

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} add-on purchase role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
