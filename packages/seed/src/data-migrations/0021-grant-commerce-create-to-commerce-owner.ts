/**
 * @fileoverview
 * Data migration: 0021-grant-commerce-create-to-commerce-owner
 *
 * Grants `COMMERCE_CREATE` to the `COMMERCE_OWNER` role's `role_permission`
 * row, mirroring the baseline assignment now made in
 * `packages/seed/src/required/rolePermissions.seed.ts`.
 *
 * ## Background (HOS-166 PR-A)
 *
 * `COMMERCE_OWNER` previously carried only `COMMERCE_EDIT_OWN` — enough to
 * edit an existing listing, but not to create one. HOS-166 moves listing
 * creation from admin-driven to owner self-service, so the role needs
 * `COMMERCE_CREATE` too. Per the project's seed dual-write rule (CLAUDE.md —
 * role→permission grants are seed DATA already present on live
 * environments), editing only the baseline `rolePermissions.seed.ts` file is
 * not enough: an already-seeded staging/prod database never re-runs the
 * `required` seed baseline, so it would never receive this new
 * `role_permission` row without this migration.
 *
 * Idempotent via `onConflictDoNothing` on the table's `(role, permission)`
 * composite primary key — safe to re-run (mirrors
 * `0014-hos-43-occupancy-permissions.ts`).
 *
 * ## `destructive` flag decision
 *
 * `false` — this only ever ADDS a grant (an `INSERT ... ON CONFLICT DO
 * NOTHING`). It never deletes or narrows access, so the production
 * destructive-migration gate does not apply.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0021-grant-commerce-create-to-commerce-owner',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Role → permission grant this migration ensures exists. */
const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    { role: RoleEnum.COMMERCE_OWNER, permission: PermissionEnum.COMMERCE_CREATE }
];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} HOS-166 COMMERCE_CREATE role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
