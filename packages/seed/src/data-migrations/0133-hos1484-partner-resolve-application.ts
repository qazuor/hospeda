/**
 * @fileoverview HOS-1484 grant for administrative action 5 (resolve a Partner
 * application by approving, rejecting, or cancelling its wait).
 * Run `db:migrate` (0186) before this migration.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0133-hos1484-partner-resolve-application',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Staff roles allowed to resolve Partner applications. */
export const STAFF_ROLES: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN];

/** Exact role grants added after structural migration 0186. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = STAFF_ROLES.map(
    (role) => ({ role, permission: PermissionEnum.PARTNER_RESOLVE_APPLICATION })
);

/** Inserts the new grants without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1484 partner application permission role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
