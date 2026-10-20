/**
 * @fileoverview HOS-1457 role grants for action 15 and billing access.
 *
 * The baseline grants these permissions on fresh databases. This required
 * migration adds the same rows to already seeded databases (HOS-25).
 *
 * Run the structural permission_enum migration 0146 (or generated 0145 on
 * this branch) before this data migration. The order is db:migrate, then
 * db:apply-extras, then db:seed:migrate. Running this first correctly fails
 * with `invalid input value for enum permission_enum`.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required, additive migration metadata. */
export const meta = {
    name: '0110-hos1457-v53-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Staff roles granted action 15 and subscription inspection. */
export const STAFF_ROLES: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN];

/** Roles already holding USER_UPDATE_SELF; these also read their own billing. */
export const OWN_BILLING_ROLES: readonly RoleEnum[] = [
    RoleEnum.SUPER_ADMIN,
    RoleEnum.ADMIN,
    RoleEnum.CLIENT_MANAGER,
    RoleEnum.EDITOR,
    RoleEnum.HOST,
    RoleEnum.GASTRONOMY_OWNER,
    RoleEnum.EXPERIENCE_OWNER,
    RoleEnum.USER,
    RoleEnum.SPONSOR
];

/** Exact (role, permission) pairs added to an already seeded database. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    ...STAFF_ROLES.flatMap((role) => [
        { role, permission: PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT },
        { role, permission: PermissionEnum.BILLING_SUBSCRIPTION_INSPECT }
    ]),
    ...OWN_BILLING_ROLES.map((role) => ({ role, permission: PermissionEnum.BILLING_VIEW_OWN }))
];

/** Inserts missing grants without changing existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1457 role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
