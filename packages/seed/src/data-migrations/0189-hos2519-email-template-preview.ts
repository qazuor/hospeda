/**
 * @fileoverview
 * Data migration: 0189-hos2519-email-template-preview
 *
 * Grants `notification.template.preview` (the admin email previewer, HOS-2519
 * D8) to SUPER_ADMIN and ADMIN (OQ-3) on already-seeded environments. The
 * baseline `required/rolePermissions.seed.ts` carries the same two grants, so a
 * fresh database ends in the same state (seed dual-write, HOS-25).
 *
 * Additive and idempotent: `onConflictDoNothing` keeps any row already present.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Required additive migration metadata for HOS-2519. */
export const meta = {
    name: '0189-hos2519-email-template-preview',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The two role grants of the email previewer permission (HOS-2519 OQ-3). */
export const GRANTS: ReadonlyArray<{
    readonly role: RoleEnum;
    readonly permission: PermissionEnum;
}> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW },
    { role: RoleEnum.ADMIN, permission: PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW }
];

/**
 * Inserts the HOS-2519 grants while preserving existing role permissions.
 *
 * @param ctx - Seed migration context; only `ctx.db` is used.
 * @returns A summary plus the granted / already-present counts.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values([...GRANTS])
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-2519 email previewer role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
