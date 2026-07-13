/**
 * @fileoverview
 * Data migration: 0012-hos-43-occupancy-permissions
 *
 * Grants the two new HOS-43 occupancy-calendar permissions
 * (`accommodation.occupancy.manage` / `accommodation.occupancy.view`) to
 * already-seeded roles, mirroring the baseline assignment in
 * `packages/seed/src/required/rolePermissions.seed.ts`:
 *
 * - HOST: `_MANAGE` + `_VIEW` (own accommodations only — enforced by the
 *   service layer, not by the role grant).
 * - ADMIN: `_VIEW` only.
 * - SUPER_ADMIN: `_MANAGE` + `_VIEW`.
 *
 * Per the repo's seed dual-write rule (CLAUDE.md — role→permission grants are
 * seed DATA already present on live environments), editing only the baseline
 * `rolePermissions.seed.ts` file is not enough: an already-seeded
 * staging/prod database never re-runs the `required` seed baseline, so it
 * would never receive these two new role_permission rows without this
 * migration.
 *
 * Idempotent via `onConflictDoNothing` on the table's `(role, permission)`
 * composite primary key — safe to re-run.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0012-hos-43-occupancy-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Role → permissions grants this migration ensures exist. */
const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.HOST, permission: PermissionEnum.ACCOMMODATION_OCCUPANCY_MANAGE },
    { role: RoleEnum.HOST, permission: PermissionEnum.ACCOMMODATION_OCCUPANCY_VIEW },
    { role: RoleEnum.ADMIN, permission: PermissionEnum.ACCOMMODATION_OCCUPANCY_VIEW },
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.ACCOMMODATION_OCCUPANCY_MANAGE },
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.ACCOMMODATION_OCCUPANCY_VIEW }
];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-43 occupancy role_permission rows (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
