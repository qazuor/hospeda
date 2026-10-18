/**
 * @fileoverview HOS-1697 grant for administrative action 7 (lift one
 * reconciliation mark, S15).
 * Run `db:migrate` (the structural migration of this leaf) before this
 * migration or the new enum value fails with `invalid input value for enum permission_enum`.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0130-hos1697-billing-lift-reconciliation-mark-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Exact role grants added after the structural migration (SUPER_ADMIN only). */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK }
];

/** Inserts the new grants without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1697 billing lift-reconciliation-mark role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
