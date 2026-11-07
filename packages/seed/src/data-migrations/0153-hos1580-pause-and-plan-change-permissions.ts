/**
 * @fileoverview HOS-1580 grants administrative actions 9 and 10 to SUPER_ADMIN.
 * Apply the structural permission enum migration before this data migration.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0153-hos1580-pause-and-plan-change-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Exact grants paired with the HOS-1580 structural migration. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_PAUSE_SUBSCRIPTION },
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN }
];

/** Insert grants idempotently without modifying other assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1580 SUPER_ADMIN role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
