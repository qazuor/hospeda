/**
 * @fileoverview HOS-1475 grant for listing moderation action 13.
 * Run `db:migrate` (0156) before this migration or the new enum value fails
 * with `invalid input value for enum permission_enum`.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0120-hos1475-v65-listing-moderate-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Roles allowed to moderate listings and partner presence. */
export const STAFF_ROLES: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN];

/** Exact role grants added after structural migration 0156. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = STAFF_ROLES.map(
    (role) => ({ role, permission: PermissionEnum.LISTING_MODERATE })
);

/** Inserts the new grants without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1475 listing moderation role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
