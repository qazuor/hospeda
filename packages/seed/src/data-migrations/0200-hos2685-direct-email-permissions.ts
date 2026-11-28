/**
 * @fileoverview HOS-2685 grants the direct email permissions (`directEmail.view`,
 * `directEmail.send`, `directEmail.template.write`) to SUPER_ADMIN and ADMIN only.
 * Run `db:migrate` (0260) first or the new enum values fail with
 * `invalid input value for enum permission_enum`. The baseline
 * (`rolePermissions.seed.ts`) carries the same grants for fresh DBs.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata. */
export const meta = {
    name: '0200-hos2685-direct-email-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const DIRECT_EMAIL_PERMISSIONS = [
    PermissionEnum.DIRECT_EMAIL_VIEW,
    PermissionEnum.DIRECT_EMAIL_SEND,
    PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE
] as const;

/** Exact grants paired with structural migration 0260 (SUPER_ADMIN and ADMIN only). */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    RoleEnum.SUPER_ADMIN,
    RoleEnum.ADMIN
].flatMap((role) => DIRECT_EMAIL_PERMISSIONS.map((permission) => ({ role, permission })));

/** Inserts the grants without modifying existing assignments. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-2685 direct email role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
