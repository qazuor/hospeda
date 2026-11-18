/** @fileoverview HOS-1512 grant of the provider watch permission (authorize the monthly run, accept a changed shape). */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0181-hos1512-provider-watch-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The provider watch permission is granted only to SUPER_ADMIN. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_PROVIDER_WATCH_MANAGE }
];

/** Inserts the additive grant without changing existing role assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1512 provider watch role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
