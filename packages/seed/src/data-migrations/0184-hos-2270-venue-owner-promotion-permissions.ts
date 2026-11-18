/**
 * @fileoverview
 * Data migration: 0184-hos-2270-venue-owner-promotion-permissions
 *
 * Gives the `VENUE_OWNER` role the six own-scoped owner-promotion permissions
 * that `HOST` already holds (HOS-2270). The baseline
 * (`src/required/rolePermissions.seed.ts`) carries the same six, so a fresh
 * database and an already-seeded one end in the same state (dual-write rule).
 *
 * The permissions only gate the venue promotion routes. Whether the owner's plan
 * includes promotions is the `create_promotions` entitlement, resolved by the
 * listing-access pipeline: a role never decides (G6).
 *
 * Idempotent: `onConflictDoNothing()` on the `(role, permission)` key.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0184-hos-2270-venue-owner-promotion-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The exact grants, the same six `HOST` holds. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    PermissionEnum.OWNER_PROMOTION_CREATE,
    PermissionEnum.OWNER_PROMOTION_VIEW_OWN,
    PermissionEnum.OWNER_PROMOTION_UPDATE_OWN,
    PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN,
    PermissionEnum.OWNER_PROMOTION_RESTORE_OWN,
    PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_OWN
].map((permission) => ({ role: RoleEnum.VENUE_OWNER, permission }));

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();
    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} owner-promotion role_permission row(s) to VENUE_OWNER (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
