/**
 * @fileoverview HOS-1540 grant for administrative action 14 (settle a charge
 * or a refund that already happened outside our flow).
 * Run `db:migrate` (0160) before this migration or the new enum value fails
 * with `invalid input value for enum permission_enum`.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0122-hos1540-billing-settle-external-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Exact role grants added after structural migration 0160 (SUPER_ADMIN only). */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_SETTLE_EXTERNAL }
];

/** Inserts the new grants without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1540 billing settle-external role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
