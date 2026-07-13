/**
 * @fileoverview
 * Data migration: 0010-remove-panel-admin-from-host-commerce-owner
 *
 * Removes the `ACCESS_PANEL_ADMIN` grant from the `HOST` and `COMMERCE_OWNER`
 * roles' `role_permission` rows.
 *
 * Background (HOS-152): HOST and COMMERCE_OWNER were incorrectly seeded with
 * `ACCESS_PANEL_ADMIN`. Combined with a web-side redirect bug, this let a
 * HOST/COMMERCE_OWNER user land in — and navigate inside — the admin panel
 * (admin.hospeda.com.ar) right after publishing their first accommodation.
 * Neither role is intended to ever reach the admin panel: both self-manage
 * entirely in the web app (`/mi-cuenta`). The seed's `ROLE_PERMISSIONS`
 * constant (`packages/seed/src/required/rolePermissions.seed.ts`) has already
 * been corrected so a fresh `db:fresh`/`db:fresh-dev` no longer grants it —
 * this migration is the companion delta for environments that already seeded
 * the bad rows (staging/prod), per the HOS-25 seed dual-write rule.
 *
 * ## `role_permission` table shape
 *
 * `role_permission` has a COMPOSITE primary key (`role`, `permission` — see
 * `packages/db/src/schemas/user/r_role_permission.dbschema.ts`), which is
 * explicitly out of scope for `ctx.helpers.safeDelete` (that helper requires
 * exactly one primary-key column — see its JSDoc). This migration instead
 * goes through `RRolePermissionModel.hardDelete()` (the same model class the
 * seed itself uses to create these rows), passing a `{ role, permission }`
 * where-object that already uniquely identifies each target row via the
 * composite key. `hardDelete` is naturally idempotent here: deleting a
 * non-existent row matches zero rows and returns a `0` count without
 * throwing, so re-running this migration (or running it on a DB that never
 * had the bad grant) is a safe no-op.
 *
 * There are no inbound FK references to `role_permission` rows (roles and
 * permissions are plain enum columns, not surrogate ids referenced
 * elsewhere), so the FK-guard concern `safeDelete` centralizes does not apply
 * to this table regardless.
 *
 * ## `destructive` flag decision
 *
 * `true` — this issues a hard `DELETE` (via `RRolePermissionModel.hardDelete`).
 * The runner's production gate therefore requires an explicit opt-in
 * (`HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION` / `--allow-destructive`) before it
 * runs in production, which is the desired behavior for a permission-grant
 * removal — even a well-understood, security-motivated one.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0010-remove-panel-admin-from-host-commerce-owner',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

/** The two roles the ACCESS_PANEL_ADMIN grant must never be assigned to (HOS-152). */
const ROLES_TO_STRIP = [RoleEnum.HOST, RoleEnum.COMMERCE_OWNER] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const rolePermissionModel = new ctx.models.RRolePermissionModel();
    const counts: Record<string, number> = {};
    let totalDeleted = 0;

    for (const role of ROLES_TO_STRIP) {
        const deletedCount = await rolePermissionModel.hardDelete(
            {
                role,
                permission: PermissionEnum.ACCESS_PANEL_ADMIN
            },
            ctx.db
        );

        counts[`${role}-deleted`] = deletedCount;
        totalDeleted += deletedCount;
    }

    return {
        summary:
            totalDeleted > 0
                ? `Removed ACCESS_PANEL_ADMIN from ${totalDeleted} role_permission row(s) (HOST/COMMERCE_OWNER).`
                : 'No ACCESS_PANEL_ADMIN rows found for HOST/COMMERCE_OWNER — already absent (idempotent no-op).',
        counts
    };
}
