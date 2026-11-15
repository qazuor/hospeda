/** @fileoverview HOS-1541 grants for administrative manual payment actions 3 and 4. */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Metadata for the additive HOS-1541 seed migration. */
export const meta = {
    name: '0137-hos1541-manual-payment-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Both manual payment actions are granted only to SUPER_ADMIN. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT },
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_DECLARE_MANUAL_UNPAID }
];

/** Inserts additive grants while preserving grants already present. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1541 manual payment role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
