/**
 * @fileoverview HOS-2349 (decision D-15) grants the admin assistant log permission
 * (`mcpActivity.view`) to SUPER_ADMIN only; ADMIN does not get it. Run `db:migrate`
 * (0231) first or the new enum value fails with
 * `invalid input value for enum permission_enum`. The baseline
 * (`rolePermissions.seed.ts`) carries the same grant for fresh DBs.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0183-hos2349-mcp-activity-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Exact grant paired with structural migration 0231 (SUPER_ADMIN only). */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.MCP_ACTIVITY_VIEW }
];

/** Inserts the grant without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-2349 SUPER_ADMIN-only role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
