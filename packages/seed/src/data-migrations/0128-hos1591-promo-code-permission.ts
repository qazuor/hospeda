/**
 * @fileoverview HOS-1591 grants the action 21 permission to SUPER_ADMIN only.
 * Run `db:migrate` first or the new enum value fails with
 * `invalid input value for enum permission_enum`.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0128-hos1591-promo-code-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Exact grant paired with structural migration 0174 (SUPER_ADMIN only). */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_MANAGE_PROMO_CODES }
];

/** Inserts the new grant without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1591 SUPER_ADMIN role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
