/** @fileoverview HOS-1551 grant for administrative action 13 (confirm a refund request). */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0133-hos1551-billing-refund-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The refund confirmation permission is granted only to SUPER_ADMIN. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_REFUND }
];

/** Inserts the additive grant without changing existing role assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1551 refund role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
