/**
 * @fileoverview
 * Data migration: 0038-hos-374-cut-editor-panel-access
 *
 * Companion delta for HOS-374 Phase 3 (D-1 / OQ-2 / NG-3): the seed's
 * `ROLE_PERMISSIONS` constant (`packages/seed/src/required/rolePermissions.seed.ts`)
 * has already been edited so a fresh `db:fresh`/`db:fresh-dev` reflects the new
 * policy — this migration is the delta for environments that already seeded
 * the old grants (staging/prod), per the HOS-25 seed dual-write rule.
 *
 * ## What changes, and why
 *
 * `EDITOR` moves from "shared editorial team, sees and edits everyone's
 * content, reachable from the admin panel" to "authors from `/mi-cuenta`,
 * scoped to its own content only" (HOS-374 §7.6.2, OQ-2, owner-confirmed
 * 2026-08-04). `CLIENT_MANAGER` simply loses panel/API-admin access — the
 * role is dormant today (NG-3), so this costs nothing now, and gets the
 * access back if it is ever activated.
 *
 * Twelve `EDITOR` grants are removed:
 * - Broad content control: `EVENT_UPDATE`, `EVENT_PUBLISH_TOGGLE`,
 *   `EVENT_VIEW_PRIVATE`, `EVENT_VIEW_DRAFT`, `EVENT_VIEW_ALL`,
 *   `POST_UPDATE`, `POST_PUBLISH_TOGGLE`, `POST_VIEW_PRIVATE`,
 *   `POST_VIEW_DRAFT`, `POST_VIEW_ALL`.
 * - Admin-tier access: `ACCESS_PANEL_ADMIN`, `ACCESS_API_ADMIN`.
 *
 * `*_PUBLISH_TOGGLE` is removed even though HOS-374 §7.6.2's permission table
 * does not name it explicitly: `checkCanSetPostPublishState` /
 * `checkCanSetEventPublishState` accept the flat `*_PUBLISH_TOGGLE` as an
 * unconditional bypass. Leaving it on `EDITOR` would let a plain editor
 * publish ANY author's content and defeat the §7.6.3 state lock outright.
 *
 * Two `CLIENT_MANAGER` grants are removed: `ACCESS_PANEL_ADMIN`,
 * `ACCESS_API_ADMIN`.
 *
 * Four new `EDITOR` grants are added — the author-scoped replacement for the
 * view/update pair above: `EVENT_VIEW_OWN`, `EVENT_UPDATE_OWN`,
 * `POST_VIEW_OWN`, `POST_UPDATE_OWN`. No `*_DELETE_OWN` / `*_PUBLISH_OWN` is
 * granted here — those are trusted-editor-only capabilities (§5.1.2, OQ-3),
 * applied per-user through `user_permission`, out of scope for this role-wide
 * migration.
 *
 * ## `role_permission` table shape
 *
 * `role_permission` has a COMPOSITE primary key (`role`, `permission` — see
 * `packages/db/src/schemas/user/r_role_permission.dbschema.ts`), out of scope
 * for `ctx.helpers.safeDelete` (which requires exactly one primary-key
 * column). There are no inbound FK references to this table either (roles
 * and permissions are plain enum columns, not surrogate ids referenced
 * elsewhere).
 *
 * ## Two mechanisms, one per direction
 *
 * - **Deletion** goes through `RRolePermissionModel.hardDelete({ role,
 *   permission }, ctx.db)`, the same model class the seed itself uses to
 *   create these rows and the same approach `0010-remove-panel-admin-from-
 *   host-commerce-owner.ts` (HOS-152's equivalent) established. Deleting a
 *   non-existent composite-key row matches zero rows and returns `0` without
 *   throwing, so re-running is a safe no-op.
 * - **Insertion** goes through a plain `ctx.db.insert(rolePermission)
 *   .values(...).onConflictDoNothing()`, matching `0026-alliance-lead-
 *   permissions.ts` (the newest precedent for "grant a role_permission row
 *   idempotently" in this package) rather than a `findOne`-then-`create`
 *   guard — `onConflictDoNothing` on the composite PK is a single
 *   round-trip and needs no separate existence check.
 *
 * ## `destructive` flag decision
 *
 * `true` — the deletion half issues real `DELETE`s that narrow access (the
 * same category `0010` and `0014` treat as destructive). The runner's
 * production gate therefore requires an explicit opt-in
 * (`HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION` / `--allow-destructive`) before this
 * runs in production — appropriate for a permission-grant removal even when,
 * as here, it is well-understood and security-motivated.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0038-hos-374-cut-editor-panel-access',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

/**
 * The `EDITOR` grants HOS-374 §7.6.2 / OQ-2 removes: broad content control + admin-tier access.
 *
 * Exported so the migration's own test can assert this list against the seed's
 * `ROLE_PERMISSIONS` directly. A test that re-declared the pairs locally would
 * compare its own copy to the seed and stay green while THIS array drifted.
 */
export const EDITOR_GRANTS_TO_REMOVE: readonly PermissionEnum[] = [
    PermissionEnum.EVENT_UPDATE,
    PermissionEnum.EVENT_PUBLISH_TOGGLE,
    PermissionEnum.EVENT_VIEW_PRIVATE,
    PermissionEnum.EVENT_VIEW_DRAFT,
    PermissionEnum.EVENT_VIEW_ALL,
    PermissionEnum.POST_UPDATE,
    PermissionEnum.POST_PUBLISH_TOGGLE,
    PermissionEnum.POST_VIEW_PRIVATE,
    PermissionEnum.POST_VIEW_DRAFT,
    PermissionEnum.POST_VIEW_ALL,
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN
];

/** The `CLIENT_MANAGER` grants HOS-374 D-1/NG-3 removes: admin-tier access only. */
export const CLIENT_MANAGER_GRANTS_TO_REMOVE: readonly PermissionEnum[] = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN
];

/** The four author-scoped `EDITOR` grants HOS-374 §7.6.2 adds, replacing the broad view/update pair. */
export const EDITOR_GRANTS_TO_ADD: readonly PermissionEnum[] = [
    PermissionEnum.EVENT_VIEW_OWN,
    PermissionEnum.EVENT_UPDATE_OWN,
    PermissionEnum.POST_VIEW_OWN,
    PermissionEnum.POST_UPDATE_OWN
];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const rolePermissionModel = new ctx.models.RRolePermissionModel();
    const counts: Record<string, number> = {};
    let totalRemoved = 0;

    for (const permission of EDITOR_GRANTS_TO_REMOVE) {
        const deletedCount = await rolePermissionModel.hardDelete(
            { role: RoleEnum.EDITOR, permission },
            ctx.db
        );
        counts[`editor-removed-${permission}`] = deletedCount;
        totalRemoved += deletedCount;
    }

    for (const permission of CLIENT_MANAGER_GRANTS_TO_REMOVE) {
        const deletedCount = await rolePermissionModel.hardDelete(
            { role: RoleEnum.CLIENT_MANAGER, permission },
            ctx.db
        );
        counts[`client-manager-removed-${permission}`] = deletedCount;
        totalRemoved += deletedCount;
    }

    const inserted = await ctx.db
        .insert(rolePermission)
        .values(EDITOR_GRANTS_TO_ADD.map((permission) => ({ role: RoleEnum.EDITOR, permission })))
        .onConflictDoNothing()
        .returning();

    counts.editorGrantsAdded = inserted.length;

    return {
        summary:
            `HOS-374 Phase 3: removed ${totalRemoved} role_permission row(s) from EDITOR/CLIENT_MANAGER ` +
            `(panel/API-admin access + broad content control) and granted ${inserted.length} of ` +
            `${EDITOR_GRANTS_TO_ADD.length} author-scoped EDITOR row(s) (rest already present).`,
        counts
    };
}
