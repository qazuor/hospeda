/**
 * @fileoverview HOS-1493 grant for administrative action 23 (purge another
 * owner's listing at the owner's request, with a reason).
 * Run `db:migrate` (0159) before this migration or the new enum value fails
 * with `invalid input value for enum permission_enum`.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0121-hos1493-purge-on-request-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Roles allowed to purge a listing at its owner's request. */
export const STAFF_ROLES: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN];

/** Exact role grants added after structural migration 0159. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = STAFF_ROLES.map(
    (role) => ({ role, permission: PermissionEnum.LISTING_PURGE_ON_REQUEST })
);

/** Inserts the new grants without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1493 listing purge-on-request role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
