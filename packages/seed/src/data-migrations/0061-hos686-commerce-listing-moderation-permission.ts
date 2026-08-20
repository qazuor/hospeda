/**
 * @fileoverview
 * Data migration: 0061-hos686-commerce-listing-moderation-permission
 *
 * Companion delta for HOS-686. The seed's `ROLE_PERMISSIONS` constant
 * (`packages/seed/src/required/rolePermissions.seed.ts`) has already been edited
 * so a fresh `db:fresh`/`db:fresh-dev` grants `COMMERCE_MODERATION_CHANGE` — this
 * migration is the delta for environments that already seeded without it
 * (staging/prod), per the HOS-25 seed dual-write rule.
 *
 * Editing only the baseline would be a silent bug of the worst shape here: fresh
 * databases would moderate fine while staging and prod answered 403 on the only
 * route that can take a commerce listing down. HOS-589 removes the
 * pre-publication admin gate on the strength of this post-publication one
 * existing, so a live environment that never receives the grant has no control
 * in either direction.
 *
 * ## What this migration grants
 *
 * `COMMERCE_MODERATION_CHANGE` to `SUPER_ADMIN` and `ADMIN` — exactly the two
 * roles that already hold `ACCOMMODATION_MODERATION_CHANGE`, and exactly the two
 * that hold the rest of the admin-tier `COMMERCE_*` block. Nothing else: an
 * `EDITOR` moderates editorial content, and a `COMMERCE_OWNER` must never be
 * able to clear the rejection on their own listing.
 *
 * ## `role_permission` table shape
 *
 * `role_permission` has a COMPOSITE primary key (`role`, `permission` — see
 * `packages/db/src/schemas/user/r_role_permission.dbschema.ts`). Insertion goes
 * through a plain `ctx.db.insert(rolePermission).values(...).onConflictDoNothing()`,
 * matching `0048-hos376-host-trade-usage-review-permissions.ts` — one idempotent
 * round-trip, no separate existence check needed.
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
    name: '0061-hos686-commerce-listing-moderation-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The single HOS-686 permission granted to `SUPER_ADMIN` and `ADMIN`.
 *
 * Exported so the migration's own test can assert it against the seed's
 * `ROLE_PERMISSIONS` directly. A test that re-declared the value locally would
 * compare its own copy to the seed and stay green while THIS constant drifted.
 */
export const STAFF_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.COMMERCE_MODERATION_CHANGE
];

/** The roles that receive it. Deliberately only the two staff roles. */
export const GRANTED_ROLES: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN];

/** `(role, permission)` pairs this migration ensures exist. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = GRANTED_ROLES.flatMap(
    (role) => STAFF_PERMISSIONS.map((permission) => ({ role, permission }))
);

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} commerce listing-moderation role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
