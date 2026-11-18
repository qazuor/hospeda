/**
 * @fileoverview HOS-2347 grants the web session recording switch
 * (`analytics.sessionRecording.manage`) to SUPER_ADMIN only. Run `db:migrate`
 * (0230) first or the new enum value fails with
 * `invalid input value for enum permission_enum`. The baseline
 * (`rolePermissions.seed.ts`) carries the same grant for fresh DBs.
 *
 * Not added to `SUPER_ADMIN_EXCLUSIVE_PERMISSIONS` (owner decision D-3): it is
 * granted to SUPER_ADMIN by the seed, but it is not locked, so a per-user
 * permission override can extend it to anyone.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0181-hos2347-session-recording-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Exact grant paired with structural migration 0230 (SUPER_ADMIN only). */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE }
];

/** Inserts the grant without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-2347 SUPER_ADMIN-only role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
