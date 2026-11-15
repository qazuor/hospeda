/** @fileoverview AC:V8b:6 ACC:25 grants for emptying a Partner presence on request. */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata for AC:V8b:6 ACC:25. */
export const meta = {
    name: '0145-hos1498-partner-empty-presence',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** AC:V8b:6 grants this action-on-request permission to staff administrators. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.PARTNER_EMPTY_PRESENCE },
    { role: RoleEnum.ADMIN, permission: PermissionEnum.PARTNER_EMPTY_PRESENCE }
];

/** Inserts the ACC:25 grants while preserving existing role permissions. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} AC:V8b:6 ACC:25 role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
