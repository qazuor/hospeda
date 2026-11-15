/**
 * @fileoverview HOS-1487 grants the partner owner permission family.
 * Run `db:migrate` (the `partner.editOwn` enum value) before this migration.
 * Covers AC:V7:18 and DEC-ENT-006📌1.
 */
import { rolePermission } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { ROLE_PERMISSIONS } from '../required/rolePermissions.seed.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0143-hos1487-partner-owner-family',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Baseline-defined partner owner grants, kept as the single source of truth. */
export const GRANTS = ROLE_PERMISSIONS[RoleEnum.PARTNER_OWNER].map((permission) => ({
    role: RoleEnum.PARTNER_OWNER,
    permission
}));

/** Adds missing partner owner grants without changing existing role permissions. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-1487 partner owner role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
