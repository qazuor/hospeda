/** @fileoverview AC:V7:17 ACC:6 grant for configuring a Partner's manual billing. */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata for AC:V7:17 ACC:6. */
export const meta = {
    name: '0144-hos1489-partner-configure-billing',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** AC:V7:17 ACC:6 grants this money-moving permission only to SUPER_ADMIN. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.PARTNER_CONFIGURE_BILLING }
];

/** Inserts the action 6 grant while preserving existing role permissions. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} AC:V7:17 ACC:6 role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
