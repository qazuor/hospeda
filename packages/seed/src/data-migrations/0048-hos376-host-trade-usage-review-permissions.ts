/**
 * @fileoverview
 * Data migration: 0048-hos376-host-trade-usage-review-permissions
 *
 * Companion delta for HOS-376 T-004. The seed's `ROLE_PERMISSIONS` constant
 * (`packages/seed/src/required/rolePermissions.seed.ts`) has already been edited
 * so a fresh `db:fresh`/`db:fresh-dev` reflects the new grants — this migration
 * is the delta for environments that already seeded without them
 * (staging/prod), per the HOS-25 seed dual-write rule.
 *
 * Editing only the baseline would be a silent bug: fresh databases would be
 * correct while every live environment never received the grants, so every
 * HOS-376 endpoint would 403 in staging and prod with nothing failing locally.
 *
 * ## What this migration grants
 *
 * - `SUPER_ADMIN` and `ADMIN`: all five — `HOST_TRADE_REVIEW_CREATE`,
 *   `_REVIEW_VIEW_ALL`, `_REVIEW_MODERATE`, `_USAGE_VIEW_ALL`, `_USAGE_MANAGE`.
 * - `HOST`: `HOST_TRADE_REVIEW_CREATE` only.
 *
 * The `HOST` grant is the load-bearing one. Rating a provider requires being a
 * real host, and `HOST` is granted only when a user creates an accommodation —
 * so a user who is ONLY a provider (owns a `host_trades` row, owns no
 * accommodations, stays a plain `USER` per HOS-278 AC-7) can never rate a
 * competitor. Granting review-create to `USER` instead would quietly delete
 * that guarantee.
 *
 * The remaining four stay staff-only on purpose: reading the moderation queue,
 * deciding on it, and lifting a provider's declaration suspension are three
 * distinct authorities, and none of them belong to a host.
 *
 * ## `role_permission` table shape
 *
 * `role_permission` has a COMPOSITE primary key (`role`, `permission` — see
 * `packages/db/src/schemas/user/r_role_permission.dbschema.ts`). Insertion goes
 * through a plain `ctx.db.insert(rolePermission).values(...).onConflictDoNothing()`,
 * matching `0039-event-organizer-permissions.ts` — one idempotent round-trip,
 * no separate existence check needed.
 *
 * ## `destructive` flag decision
 *
 * `false` — this only ever ADDS grants (`INSERT ... ON CONFLICT DO NOTHING`).
 * It never deletes or narrows access, so the production destructive-migration
 * gate does not apply.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0048-hos376-host-trade-usage-review-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The five HOS-376 permissions granted to `SUPER_ADMIN` and `ADMIN`.
 *
 * Exported so the migration's own test can assert this list against the seed's
 * `ROLE_PERMISSIONS` directly. A test that re-declared the pairs locally would
 * compare its own copy to the seed and stay green while THIS array drifted.
 */
export const STAFF_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.HOST_TRADE_REVIEW_CREATE,
    PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL,
    PermissionEnum.HOST_TRADE_REVIEW_MODERATE,
    PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL,
    PermissionEnum.HOST_TRADE_USAGE_MANAGE
];

/** The narrow grant given to `HOST`: rate a provider, nothing else. */
export const HOST_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.HOST_TRADE_REVIEW_CREATE
];

/** `(role, permission)` pairs this migration ensures exist. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    ...STAFF_PERMISSIONS.map((permission) => ({ role: RoleEnum.SUPER_ADMIN, permission })),
    ...STAFF_PERMISSIONS.map((permission) => ({ role: RoleEnum.ADMIN, permission })),
    ...HOST_PERMISSIONS.map((permission) => ({ role: RoleEnum.HOST, permission }))
];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} host-trade usage/review role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
