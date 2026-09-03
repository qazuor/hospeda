/**
 * @fileoverview
 * Data migration: 0079-hos-1077-vertical-commerce-permissions
 *
 * The live-environment half of HOS-1077's EXPAND release. The baseline half
 * (`packages/seed/src/required/rolePermissions.seed.ts`) is already edited, so a
 * fresh `db:fresh`/`db:fresh-dev` builds the new grants; this is the delta for
 * environments that seeded before them, per the HOS-25 seed dual-write rule.
 *
 * ## What HOS-1077 is fixing
 *
 * The seven `commerce.*` permissions name TWO product verticals at once, so
 * granting edit rights over gastronomy necessarily granted them over
 * experiences: a restaurant moderator moderated excursions, by construction.
 * The split gives each vertical its own seven, plus a per-vertical owner role
 * in parity with `HOST`.
 *
 * ## Expand, not contract — nothing is removed here
 *
 * This migration only ever INSERTS. The `commerce.*` rows stay exactly where
 * they are, every gate reads either family (the dual-read in
 * `packages/service-core/src/services/commerce/commerce.permissions.ts`), and
 * `COMMERCE_OWNER` stays on every account that has it. Release 2 removes the
 * legacy family in its own migration, once this one has run everywhere.
 *
 * That ordering is not ceremony. `role_permission` and `user_role` are live
 * production tables read on every request through the actor cache; a release
 * that added the new rows and deleted the old ones at once would, for the
 * duration of the rollout, have some pods reading a permission the database no
 * longer grants.
 *
 * ## Three deltas
 *
 * 1. **Staff `role_permission`** — the twelve admin-tier permissions
 *    (`{gastronomy,experience}.{create,viewAll,editAll,delete,moderateReview,moderationChange}`)
 *    to `SUPER_ADMIN` and `ADMIN`, the same two roles that already hold the
 *    `commerce.*` admin block. Nothing else: an `EDITOR` moderates editorial
 *    content, and an owner must never be able to clear the rejection on their
 *    own listing.
 *
 * 2. **New-role `role_permission`** — `GASTRONOMY_OWNER` and `EXPERIENCE_OWNER`
 *    are brand-new enum values, so a live database holds ZERO rows for them.
 *    Their full permission sets are inserted here, declared as literals rather
 *    than read from `ROLE_PERMISSIONS`: a migration that derived its effect from
 *    a constant later edits can change would mean an already-ledgered migration
 *    silently describing something it never did. The companion test asserts
 *    these literals equal the seed exactly, so the two cannot drift apart
 *    unnoticed.
 *
 * 3. **`user_role`** — the vertical owner role for every account that owns a
 *    listing of that vertical.
 *
 * ## Why (3) reads the listings instead of copying `COMMERCE_OWNER`
 *
 * Handing both new roles to every `COMMERCE_OWNER` would be the one-line
 * version, and it would re-create the exact coupling this issue exists to
 * remove: an account that only ever ran a restaurant would come out of the
 * migration holding authority over experiences. So the grant is derived from
 * what each account actually owns — `gastronomies.owner_id` and
 * `experiences.owner_id`, soft-deleted rows excluded. An owner of both gets
 * both roles because they genuinely are both.
 *
 * Nobody is stranded by the narrower rule: `COMMERCE_OWNER` is untouched and
 * still carries the legacy `commerce.*` permissions every gate accepts, so an
 * account this migration skips loses nothing today. Release 2 is where the
 * narrowing takes effect, which is also when a listing-less `COMMERCE_OWNER`
 * (an account whose only listing was deleted) correctly stops being one.
 *
 * ## `destructive` flag decision
 *
 * `false` — every statement is `INSERT ... ON CONFLICT DO NOTHING`. Nothing is
 * deleted, nothing is narrowed, and re-running it is a no-op, so the production
 * destructive-migration gate does not apply.
 */
import { experiences, gastronomies, isNull, rolePermission, userRole } from '@repo/db';
import { PermissionEnum, RoleEnum, RoleGrantReason } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0079-hos-1077-vertical-commerce-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The twelve admin-tier permissions granted to staff.
 *
 * Exported so the migration's own test can compare them against the seed's
 * `ROLE_PERMISSIONS` directly. A test that re-declared the list locally would
 * compare its own copy to the seed and stay green while THIS constant drifted.
 */
export const STAFF_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.GASTRONOMY_CREATE,
    PermissionEnum.GASTRONOMY_VIEW_ALL,
    PermissionEnum.GASTRONOMY_EDIT_ALL,
    PermissionEnum.GASTRONOMY_DELETE,
    PermissionEnum.GASTRONOMY_MODERATE_REVIEW,
    PermissionEnum.GASTRONOMY_MODERATION_CHANGE,
    PermissionEnum.EXPERIENCE_CREATE,
    PermissionEnum.EXPERIENCE_VIEW_ALL,
    PermissionEnum.EXPERIENCE_EDIT_ALL,
    PermissionEnum.EXPERIENCE_DELETE,
    PermissionEnum.EXPERIENCE_MODERATE_REVIEW,
    PermissionEnum.EXPERIENCE_MODERATION_CHANGE
];

/** The roles that receive {@link STAFF_PERMISSIONS}. Deliberately only staff. */
export const STAFF_ROLES: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN];

/**
 * Everything except the two vertical-specific permissions that a vertical owner
 * role grants — the account-level permissions `COMMERCE_OWNER` already carries.
 *
 * Kept as one shared list because the two owner roles differ ONLY in their
 * `editOwn`/`create` pair; spelling the other twenty-five out twice would be an
 * invitation for the copies to drift.
 */
const OWNER_SHARED_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.USER_VIEW_PROFILE,
    PermissionEnum.USER_UPDATE_PROFILE,
    PermissionEnum.USER_SETTINGS_UPDATE,
    PermissionEnum.RECOMMENDATION_VIEW,
    PermissionEnum.USER_BOOKMARK_CREATE,
    PermissionEnum.USER_BOOKMARK_UPDATE,
    PermissionEnum.USER_BOOKMARK_DELETE,
    PermissionEnum.USER_BOOKMARK_VIEW,
    PermissionEnum.USER_BOOKMARK_RESTORE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
    PermissionEnum.DASHBOARD_BASE_VIEW,
    PermissionEnum.ACCESS_API_PUBLIC,
    PermissionEnum.MEDIA_UPLOAD,
    PermissionEnum.MEDIA_DELETE,
    PermissionEnum.CONVERSATION_VIEW_OWN,
    PermissionEnum.CONVERSATION_REPLY_OWN,
    PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
    PermissionEnum.CONVERSATION_BLOCK_OWN,
    PermissionEnum.BILLING_VIEW_OWN,
    PermissionEnum.SUBSCRIPTION_VIEW_OWN,
    PermissionEnum.USER_UPDATE_SELF,
    PermissionEnum.BILLING_ADDON_PURCHASE
];

/** The full permission set for `GASTRONOMY_OWNER`, in seed order. */
export const GASTRONOMY_OWNER_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.GASTRONOMY_EDIT_OWN,
    PermissionEnum.GASTRONOMY_CREATE,
    ...OWNER_SHARED_PERMISSIONS
];

/** The full permission set for `EXPERIENCE_OWNER`, in seed order. */
export const EXPERIENCE_OWNER_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.EXPERIENCE_EDIT_OWN,
    PermissionEnum.EXPERIENCE_CREATE,
    ...OWNER_SHARED_PERMISSIONS
];

/** Every `(role, permission)` pair this migration ensures exists. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    ...STAFF_ROLES.flatMap((role) => STAFF_PERMISSIONS.map((permission) => ({ role, permission }))),
    ...GASTRONOMY_OWNER_PERMISSIONS.map((permission) => ({
        role: RoleEnum.GASTRONOMY_OWNER,
        permission
    })),
    ...EXPERIENCE_OWNER_PERMISSIONS.map((permission) => ({
        role: RoleEnum.EXPERIENCE_OWNER,
        permission
    }))
];

/**
 * The listing table whose owners receive each vertical role.
 *
 * A plain lookup rather than a branch, so adding a third vertical is a row here
 * and nothing else.
 */
const VERTICAL_OWNER_SOURCES = [
    { role: RoleEnum.GASTRONOMY_OWNER, table: gastronomies },
    { role: RoleEnum.EXPERIENCE_OWNER, table: experiences }
] as const;

/**
 * Applies the HOS-1077 expand delta.
 *
 * @param ctx - The migration context carrying the transactional Drizzle client.
 * @returns A summary plus per-delta counts.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const insertedGrants = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    let ownersGranted = 0;
    let ownersConsidered = 0;

    for (const { role, table } of VERTICAL_OWNER_SOURCES) {
        // Distinct owners of at least one live listing of this vertical.
        // Soft-deleted listings do not make anyone an owner.
        const owners = await ctx.db
            .selectDistinct({ ownerId: table.ownerId })
            .from(table)
            .where(isNull(table.deletedAt));

        const userIds = owners
            .map((row) => row.ownerId)
            .filter((ownerId): ownerId is string => typeof ownerId === 'string');

        ownersConsidered += userIds.length;
        if (userIds.length === 0) {
            continue;
        }

        const insertedRoles = await ctx.db
            .insert(userRole)
            .values(
                userIds.map((userId) => ({
                    userId,
                    role,
                    grantedBy: null,
                    grantReason: RoleGrantReason.COMMERCE_LISTING_CREATED
                }))
            )
            .onConflictDoNothing()
            .returning();

        ownersGranted += insertedRoles.length;
    }

    return {
        summary:
            `Granted ${insertedGrants.length} of ${GRANTS.length} vertical role_permission row(s) ` +
            `and ${ownersGranted} of ${ownersConsidered} vertical owner user_role row(s) ` +
            '(rest already present).',
        counts: {
            rolePermissionsGranted: insertedGrants.length,
            rolePermissionsAlreadyPresent: GRANTS.length - insertedGrants.length,
            ownerRolesGranted: ownersGranted,
            ownerRolesConsidered: ownersConsidered
        }
    };
}
