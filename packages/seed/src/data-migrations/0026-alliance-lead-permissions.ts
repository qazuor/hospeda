/**
 * @fileoverview
 * Data migration: 0026-alliance-lead-permissions
 *
 * Grants the two new HOS-277 alliance-leads permissions
 * (`allianceLead.viewAll` / `allianceLead.manage`) to the `ADMIN` and
 * `SUPER_ADMIN` roles, mirroring the baseline assignment made in
 * `packages/seed/src/required/rolePermissions.seed.ts`.
 *
 * ## Background (HOS-277 §7.5)
 *
 * `alliance_leads` is a new table/permission family — the admin inbox for
 * partner/sponsor/editor/service_provider leads. Per the project's seed
 * dual-write rule (CLAUDE.md — role→permission grants are seed DATA already
 * present on live environments), editing only the baseline
 * `rolePermissions.seed.ts` file is not enough: an already-seeded
 * staging/prod database never re-runs the `required` seed baseline, so it
 * would never receive these two new `role_permission` rows without this
 * migration.
 *
 * Idempotent via `onConflictDoNothing` on the table's `(role, permission)`
 * composite primary key — safe to re-run (mirrors
 * `0014-hos-43-occupancy-permissions.ts` / `0021-grant-commerce-create-to-commerce-owner.ts`).
 *
 * ## `destructive` flag decision
 *
 * `false` — this only ever ADDS grants (an `INSERT ... ON CONFLICT DO
 * NOTHING`). It never deletes or narrows access, so the production
 * destructive-migration gate does not apply.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0026-alliance-lead-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Role → permission grants this migration ensures exist. */
const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.ALLIANCE_LEAD_VIEW_ALL },
    { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.ALLIANCE_LEAD_MANAGE },
    { role: RoleEnum.ADMIN, permission: PermissionEnum.ALLIANCE_LEAD_VIEW_ALL },
    { role: RoleEnum.ADMIN, permission: PermissionEnum.ALLIANCE_LEAD_MANAGE }
];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-277 alliance-lead role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
