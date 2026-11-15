/**
 * @fileoverview HOS-1810 grant of the location-exception permission.
 * Run `db:migrate` (0205) before this migration or the new enum values fail
 * with `invalid input value for enum permission_enum`.
 *
 * Dual-write counterpart (HOS-25) of the baseline edit in
 * `required/rolePermissions.seed.ts`.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0173-hos-1810-location-exception-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Roles that manage location exceptions. */
export const STAFF_ROLES: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN];

/** Permission introduced by HOS-1810. */
export const PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.LISTING_LOCATION_EXCEPTION_MANAGE
];

/** Exact role grants added after structural migration 0205. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = STAFF_ROLES.flatMap(
    (role) => PERMISSIONS.map((permission) => ({ role, permission }))
);

/** Inserts the new grants without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1810 location-exception role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
